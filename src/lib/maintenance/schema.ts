import { z } from "zod";
import {
  expenseInputSchema,
  instantSchema,
  reasonSchema,
} from "@/lib/finance/schema";
const mileage = z.number().int().min(0).max(99999999),
  base = {
    maintenance_id: z.uuid(),
    expected_version: z.number().int().positive(),
  };
const validPeriod = (v: { start_at: string; end_at: string }) =>
  Date.parse(v.end_at) > Date.parse(v.start_at) &&
  Date.parse(v.end_at) - Date.parse(v.start_at) <= 3660 * 86400000;
export const maintenanceKinds = {
  PREVENTIVE: "Preventiva",
  CORRECTIVE: "Corretiva",
  OIL: "Troca de óleo",
  TIRES: "Pneus",
  SERVICE: "Revisão",
} as const;
export const maintenanceStatuses = {
  SCHEDULED: "Agendada",
  IN_PROGRESS: "Em execução",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
} as const;
export const maintenanceCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("CREATE"),
      vehicle_id: z.uuid(),
      kind: z.enum(["PREVENTIVE", "CORRECTIVE", "OIL", "TIRES", "SERVICE"]),
      mileage,
      start_at: instantSchema,
      end_at: instantSchema,
      blocks_availability: z.boolean(),
      description: z.string().trim().min(5).max(2000),
    })
    .strict()
    .refine(validPeriod, "Período inválido."),
  z.object({ ...base, action: z.literal("START") }).strict(),
  z
    .object({
      ...base,
      action: z.literal("RESCHEDULE"),
      start_at: instantSchema,
      end_at: instantSchema,
    })
    .strict()
    .refine(validPeriod, "Período inválido."),
  z
    .object({ ...base, action: z.literal("EXTEND"), end_at: instantSchema })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("COMPLETE"),
      mileage,
      next_due_on: z.iso.date().nullable(),
      next_due_mileage: mileage.nullable(),
      expense: expenseInputSchema.nullable(),
    })
    .strict()
    .refine(
      (v) => v.next_due_mileage === null || v.next_due_mileage >= v.mileage,
      "Próxima quilometragem deve ser igual ou maior que a atual.",
    ),
  z
    .object({ ...base, action: z.literal("CANCEL"), reason: reasonSchema })
    .strict(),
]);
export const maintenanceFilters = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    status: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
    ),
  })
  .strict();
