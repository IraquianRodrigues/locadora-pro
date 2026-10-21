import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import { parseTimezone } from "@/config/env";
export const reportLabels = {
  REVENUE: "Valores contratados por competência",
  RECEIPTS: "Recebimentos e reembolsos",
  EXPENSES: "Despesas e estornos por veículo",
  PROFITABILITY: "Resultado contratado por veículo",
  BALANCES: "Contas a receber por vencimento",
  RESERVATIONS: "Reservas por situação",
  OCCUPANCY: "Ocupação da frota",
  RECURRING: "Clientes recorrentes",
  OVERDUE: "Locações em atraso",
  MAINTENANCE: "Manutenções concluídas",
} as const;
export const financeReports = new Set([
  "REVENUE",
  "RECEIPTS",
  "EXPENSES",
  "PROFITABILITY",
  "BALANCES",
]);
export const reportKindSchema = z.enum([
  "REVENUE",
  "RECEIPTS",
  "EXPENSES",
  "PROFITABILITY",
  "BALANCES",
  "RESERVATIONS",
  "OCCUPANCY",
  "RECURRING",
  "OVERDUE",
  "MAINTENANCE",
]);
export const periodSchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .strict()
  .refine((v) => {
    const days = Temporal.PlainDate.from(v.to).since(
      Temporal.PlainDate.from(v.from),
      { largestUnit: "days" },
    ).days;
    return days >= 0 && days <= 365;
  }, "Escolha até 366 dias, com fim igual ou posterior ao início.");
export const reportFilterSchema = z
  .object({
    ...periodSchema.shape,
    kind: reportKindSchema,
    page: z.coerce.number().int().min(1).max(10000).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
  .refine(
    (v) => periodSchema.safeParse({ from: v.from, to: v.to }).success,
    "Período inválido.",
  );
export function reportDefaults() {
  const today = Temporal.Now.plainDateISO(
    parseTimezone(process.env.APP_TIMEZONE),
  );
  return { from: today.with({ day: 1 }).toString(), to: today.toString() };
}
export function periodBounds(raw: unknown) {
  const v = periodSchema.parse(raw),
    timezone = parseTimezone(process.env.APP_TIMEZONE);
  return {
    from_at: Temporal.PlainDate.from(v.from)
      .toZonedDateTime({ timeZone: timezone, plainTime: "00:00" })
      .toInstant()
      .toString(),
    to_at: Temporal.PlainDate.from(v.to)
      .add({ days: 1 })
      .toZonedDateTime({ timeZone: timezone, plainTime: "00:00" })
      .toInstant()
      .toString(),
  };
}
