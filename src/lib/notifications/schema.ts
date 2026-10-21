import { z } from "zod";
import { reasonSchema } from "@/lib/finance/schema";
const text = z.string().trim().min(10).max(8000);
const validVariables = (v: { subject: string; body: string }) =>
  !/[{}]/.test(
    (v.subject + v.body)
      .replaceAll("{reference}", "")
      .replaceAll("{status}", "")
      .replaceAll("{date}", "")
      .replaceAll("{event}", ""),
  );
export const notificationSetupSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("TEMPLATE"),
      name: z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/),
      version: z.number().int().positive(),
      channel: z.enum(["IN_APP", "EMAIL"]),
      subject: z
        .string()
        .trim()
        .min(3)
        .max(160)
        .refine((v) => !/[\r\n]/.test(v)),
      body: text,
    })
    .strict()
    .refine(
      validVariables,
      "Use somente {reference}, {status}, {date} e {event}.",
    ),
  z
    .object({
      kind: z.literal("ROUTE"),
      event_type: z.string().regex(/^[a-z][a-z0-9_.]{2,99}$/),
      channel: z.enum(["IN_APP", "EMAIL"]),
      target: z.enum(["OPERATIONS", "FINANCE", "CUSTOMER"]),
      template_id: z.uuid(),
      enabled: z.boolean(),
      expected_updated_at: z.iso.datetime({ offset: true }).nullable(),
    })
    .strict()
    .refine(
      (v) =>
        v.channel === "EMAIL"
          ? v.target === "CUSTOMER" &&
            /^(reservation|rental)\./.test(v.event_type)
          : v.target !== "CUSTOMER",
      "E-mail é para o cliente; painel é para a equipe.",
    ),
]);
export const retryNotificationSchema = z
  .object({
    kind: z.enum(["EMAIL", "OUTBOX"]),
    id: z.uuid(),
    reason: reasonSchema,
  })
  .strict();
export const notificationEvents = {
  "reservation.requested": "Reserva solicitada",
  "reservation.confirmed": "Reserva confirmada",
  "reservation.rejected": "Reserva rejeitada",
  "reservation.cancelled": "Reserva cancelada",
  "reservation.expired": "Reserva expirada",
  "rental.created": "Locação criada",
  "rental.checkout": "Retirada",
  "rental.checkin": "Devolução",
  "rental.extended": "Prorrogação",
  "rental.overdue": "Atraso",
  "rental.cancel": "Locação cancelada",
  "maintenance.create": "Manutenção agendada",
  "maintenance.complete": "Manutenção concluída",
  "maintenance.due": "Manutenção por data/km",
  "finance.charge": "Cobrança",
  "finance.payment": "Recebimento",
  "finance.deposit_receive": "Caução recebida",
  "finance.deposit_apply": "Caução aplicada",
  "finance.refund": "Reembolso",
  "finance.expense": "Despesa",
} as const;
