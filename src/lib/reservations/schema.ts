import { z } from "zod";
import { addressSchema } from "@/lib/registry/schema";
import { moneySchema, policySchema } from "@/lib/pricing/policy";
export const bookingInputSchema = z
  .object({
    rate_plan_id: z.uuid(),
    branch_id: z.uuid(),
    vehicle_id: z.uuid().nullable(),
    category_id: z.uuid().nullable(),
    start_at: z.iso.datetime({ offset: true }),
    end_at: z.iso.datetime({ offset: true }),
    customer_id: z.uuid().nullable(),
    additional_services: z
      .array(
        z
          .object({ id: z.uuid(), quantity: z.number().int().min(1).max(100) })
          .strict(),
      )
      .max(20),
    pickup_mode: z.enum(["BRANCH", "DELIVERY"]),
    return_mode: z.enum(["BRANCH", "COLLECTION"]),
    pickup_address: addressSchema.nullable(),
    return_address: addressSchema.nullable(),
    instructions: z.string().trim().max(500),
    discount_amount: moneySchema,
    discount_reason: z.string().trim().max(500),
  })
  .strict()
  .superRefine((v, c) => {
    if (Number(!!v.vehicle_id) + Number(!!v.category_id) !== 1)
      c.addIssue({
        code: "custom",
        path: ["category_id"],
        message: "Escolha categoria ou veículo, exclusivamente.",
      });
    const duration = Date.parse(v.end_at) - Date.parse(v.start_at);
    if (duration <= 0 || duration > 3660 * 86400000)
      c.addIssue({
        code: "custom",
        path: ["end_at"],
        message: "Período deve ser positivo e ter até 3660 dias.",
      });
    if ((v.pickup_mode === "DELIVERY") !== (v.pickup_address !== null))
      c.addIssue({
        code: "custom",
        path: ["pickup_address"],
        message: "Informe endereço somente para entrega.",
      });
    if ((v.return_mode === "COLLECTION") !== (v.return_address !== null))
      c.addIssue({
        code: "custom",
        path: ["return_address"],
        message: "Informe endereço somente para coleta.",
      });
    if (
      new Set(v.additional_services.map((s) => s.id)).size !==
      v.additional_services.length
    )
      c.addIssue({
        code: "custom",
        path: ["additional_services"],
        message: "Serviço adicional repetido.",
      });
    if (v.discount_amount !== "0.00" && v.discount_reason.length < 5)
      c.addIssue({
        code: "custom",
        path: ["discount_reason"],
        message: "Desconto exige motivo de pelo menos cinco caracteres.",
      });
  });
export type BookingInput = z.infer<typeof bookingInputSchema>;
export const catalogSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  revision: z.number().int(),
  plan: z.object({
    id: z.uuid(),
    name: z.string(),
    version: z.number().int(),
    period_unit: z.enum(["DAY", "WEEK", "MONTH"]),
    month_mode: z.enum(["COMMERCIAL", "CALENDAR"]).nullable(),
    commercial_month_days: z.number().nullable(),
    policy: policySchema,
  }),
  price: z.object({
    id: z.uuid(),
    amount: moneySchema,
    scope: z.enum(["VEHICLE", "CATEGORY"]),
  }),
  addons: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      unit: z.enum(["ONCE", "DAY", "WEEK", "MONTH", "HOUR"]),
      amount: moneySchema,
    }),
  ),
});
export type PricingCatalog = z.infer<typeof catalogSchema>;
export const idempotencySchema = z
  .string()
  .min(16)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/);
export const requestInputSchema = z
  .object({
    quote_id: z.uuid(),
    customer_id: z.uuid(),
    idempotency_key: idempotencySchema,
  })
  .strict();
export const decisionSchema = z
  .object({
    expected_version: z.number().int().min(1),
    idempotency_key: idempotencySchema,
    target: z.enum(["CONFIRMED", "UNDER_REVIEW", "REJECTED", "CANCELLED"]),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
export const reservationStatuses = [
  "REQUESTED",
  "UNDER_REVIEW",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
  "CONVERTED",
] as const;
