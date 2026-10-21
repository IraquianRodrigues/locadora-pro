import { z } from "zod";
import { idempotencySchema } from "@/lib/reservations/schema";
import { addressSchema } from "@/lib/registry/schema";
import {
  normalizeDocument,
  validCnpj,
  normalizePhone,
  validPhone,
} from "@/lib/registry/brazil";
const notes = z.string().trim().max(1000);
const reason = notes.min(5);
const fuel = z.coerce.number().min(0).max(100).multipleOf(0.01);
const mileage = z.coerce.number().int().min(0).max(99999999);
const rates = z.string().regex(/^(0|[1-9][0-9]{0,7})\.[0-9]{2}$/);
export const checklistSchema = z
  .array(
    z
      .object({
        key: z.string().regex(/^[a-z0-9_]{1,50}$/),
        label: z.string().trim().min(1).max(160),
        photo_required: z.boolean(),
      })
      .strict(),
  )
  .min(1)
  .max(80)
  .refine(
    (v) => new Set(v.map((i) => i.key)).size === v.length,
    "Itens repetidos.",
  );
export const operationalPolicySchema = z
  .object({
    version: z.literal(1),
    checkout_payment: z.enum(["FULL", "NONE"]),
    checkin_balance: z.enum(["SETTLED", "ALLOW_DUE"]),
    require_deposit: z.boolean(),
    require_documents: z.boolean(),
    license_categories: z
      .array(z.enum(["B", "C", "D", "E", "AB", "AC", "AD", "AE"]))
      .min(1)
      .max(8),
    inspection_template_id: z.uuid(),
    contract_template_id: z.uuid(),
    included_km_per_day: z.number().int().min(0).max(9999999),
    late_tolerance_minutes: z.number().int().min(0).max(1440),
    extra_km_amount: rates,
    fuel_percent_amount: rates,
    late_hour_amount: rates,
  })
  .strict();
export type OperationalPolicy = z.infer<typeof operationalPolicySchema>;
export const setupSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("COMPANY"),
      legal_name: z.string().trim().min(1).max(200),
      tax_document: z
        .string()
        .transform(normalizeDocument)
        .refine(validCnpj, "CNPJ inválido."),
      timezone: z
        .string()
        .max(100)
        .refine((v) => {
          try {
            new Intl.DateTimeFormat("pt-BR", { timeZone: v });
            return true;
          } catch {
            return false;
          }
        }, "Fuso IANA inválido."),
      contact: z
        .object({
          address: addressSchema,
          email: z.email().max(254),
          phone: z
            .string()
            .transform(normalizePhone)
            .refine(validPhone, "Telefone inválido."),
        })
        .strict(),
      expected_updated_at: z.string().nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("POLICY"),
      policy: operationalPolicySchema,
      expected_updated_at: z.string().nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("INSPECTION_TEMPLATE"),
      name: z.string().trim().min(1).max(100),
      version: z.number().int().positive(),
      checklist: checklistSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("CONTRACT_TEMPLATE"),
      name: z.string().trim().min(1).max(100),
      version: z.number().int().positive(),
      body: z.string().trim().min(30).max(40000),
      review_status: z.enum(["APPROVED", "LEGAL_REVIEW_REQUIRED"]),
      legal_review_confirmed: z.boolean(),
    })
    .strict()
    .refine(
      (v) => v.review_status !== "APPROVED" || v.legal_review_confirmed,
      "Confirme a revisão jurídica antes de aprovar.",
    ),
]);
export const createRentalSchema = z.union([
  z
    .object({
      reservation_id: z.uuid(),
      expected_version: z.number().int().positive(),
    })
    .strict(),
  z.object({ quote_id: z.uuid(), vehicle_id: z.uuid() }).strict(),
]);
const base = {
  rental_id: z.uuid(),
  expected_version: z.number().int().positive(),
};
export const commandSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...base,
      action: z.literal("DRIVERS"),
      driver_ids: z
        .array(z.uuid())
        .min(1)
        .max(10)
        .refine((v) => new Set(v).size === v.length),
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("INSPECTION"),
      kind: z.enum(["INITIAL", "FINAL"]),
      mileage,
      fuel,
      notes,
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("ITEMS"),
      inspection_id: z.uuid(),
      items: z
        .array(
          z
            .object({
              key: z.string().regex(/^[a-z0-9_]{1,50}$/),
              condition: z.enum(["OK", "DAMAGE", "MISSING", "NOT_APPLICABLE"]),
              notes,
            })
            .strict()
            .refine(
              (v) =>
                !["DAMAGE", "MISSING"].includes(v.condition) ||
                v.notes.length >= 5,
              "Descreva a avaria ou ausência.",
            ),
        )
        .min(1)
        .max(80)
        .refine((v) => new Set(v.map((i) => i.key)).size === v.length),
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("COMPLETE_INSPECTION"),
      inspection_id: z.uuid(),
    })
    .strict(),
  z.object({ ...base, action: z.literal("CONTRACT") }).strict(),
  z
    .object({
      ...base,
      action: z.literal("RETRY_CONTRACT"),
      contract_id: z.uuid(),
    })
    .strict(),
  z.object({ ...base, action: z.literal("CHECKOUT") }).strict(),
  z.object({ ...base, action: z.literal("CHECKIN") }).strict(),
  z.object({ ...base, action: z.literal("CANCEL"), reason }).strict(),
  z
    .object({
      ...base,
      action: z.literal("ASSESS_DAMAGE"),
      damage_id: z.uuid(),
      amount: z.string().regex(/^(0|[1-9][0-9]{0,9})\.[0-9]{2}$/),
      reason,
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("LOGISTICS"),
      direction: z.enum(["PICKUP", "RETURN"]),
      notes: reason,
    })
    .strict(),
]);
export const operationEnvelope = z
  .object({ input: z.unknown(), idempotency_key: idempotencySchema })
  .strict();
export const extensionSchema = z
  .object({ rental_id: z.uuid(), quote_id: z.uuid() })
  .strict();
export const commandPermissions: Record<
  z.infer<typeof commandSchema>["action"],
  string
> = {
  DRIVERS: "rentals.create",
  INSPECTION: "inspections.write",
  ITEMS: "inspections.write",
  COMPLETE_INSPECTION: "inspections.write",
  CONTRACT: "contracts.generate",
  RETRY_CONTRACT: "contracts.generate",
  CHECKOUT: "rentals.checkout",
  CHECKIN: "rentals.checkin",
  CANCEL: "rentals.create",
  LOGISTICS: "rentals.create",
  ASSESS_DAMAGE: "charges.create",
};
export const rentalLabels: Record<string, string> = {
  PREPARING: "Em preparação",
  ACTIVE: "Em andamento",
  OVERDUE: "Em atraso",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};
