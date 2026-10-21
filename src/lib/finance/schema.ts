import { z } from "zod";
import { moneySchema } from "@/lib/pricing/policy";
import { cents } from "@/lib/pricing/money";
import { idempotencySchema } from "@/lib/reservations/schema";
export const positiveMoney = moneySchema.refine(
  (v) => cents(v) > 0n,
  "Informe um valor maior que zero.",
);
export const reasonSchema = z.string().trim().min(5).max(1000);
export const instantSchema = z.iso.datetime({ offset: true });
const reference = z.uuid().nullable();
export const expenseInputSchema = z
  .object({
    amount: positiveMoney,
    occurred_at: instantSchema,
    description: reasonSchema,
    payment_method_id: z.uuid(),
    paid: z.literal(true),
  })
  .strict();
export const financeCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("CHARGE"),
      customer_id: z.uuid(),
      rental_id: reference,
      kind: z.enum(["MANUAL", "FINE"]),
      amount: positiveMoney,
      due_at: instantSchema,
      competence_at: instantSchema,
      description: reasonSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("PAYMENT"),
      customer_id: z.uuid(),
      payment_method_id: z.uuid(),
      amount: positiveMoney,
      received: z.literal(true),
      allocations: z
        .array(
          z.object({ charge_id: z.uuid(), amount: positiveMoney }).strict(),
        )
        .max(50),
    })
    .strict()
    .superRefine((v, c) => {
      if (
        new Set(v.allocations.map((a) => a.charge_id)).size !==
        v.allocations.length
      )
        c.addIssue({
          code: "custom",
          message: "Cobranças repetidas na alocação.",
        });
      if (
        v.allocations.reduce((sum, a) => sum + cents(a.amount), 0n) >
        cents(v.amount)
      )
        c.addIssue({
          code: "custom",
          message: "Alocações excedem o recebimento.",
        });
    }),
  z
    .object({
      action: z.literal("ALLOCATE"),
      payment_id: z.uuid(),
      charge_id: z.uuid(),
      amount: positiveMoney,
    })
    .strict(),
  z
    .object({
      action: z.literal("DEPOSIT_RECEIVE"),
      rental_id: z.uuid(),
      payment_method_id: z.uuid(),
      amount: positiveMoney,
      received: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal("DEPOSIT_APPLY"),
      deposit_id: z.uuid(),
      charge_id: z.uuid(),
      amount: positiveMoney,
      reason: reasonSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("DEPOSIT_UNAPPLY"),
      application_id: z.uuid(),
      amount: positiveMoney,
      reason: reasonSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("REFUND"),
      payment_id: reference,
      deposit_id: reference,
      allocation_id: reference,
      amount: positiveMoney,
      payment_method_id: z.uuid(),
      reason: reasonSchema,
      paid_out: z.literal(true),
    })
    .strict()
    .refine(
      (v) =>
        Number(!!v.payment_id) + Number(!!v.deposit_id) === 1 &&
        (!v.allocation_id || !!v.payment_id),
      "Escolha um pagamento ou uma caução de origem.",
    ),
  z
    .object({
      action: z.literal("ADJUST"),
      charge_id: z.uuid(),
      kind: z.enum(["DISCOUNT", "CANCEL", "CORRECTION"]),
      amount: positiveMoney,
      reason: reasonSchema,
    })
    .strict(),
  z
    .object({
      ...expenseInputSchema.shape,
      action: z.literal("EXPENSE"),
      vehicle_id: reference,
      maintenance_id: reference,
    })
    .strict()
    .refine(
      (v) => !v.maintenance_id || !!v.vehicle_id,
      "A manutenção exige o veículo correspondente.",
    ),
  z
    .object({
      action: z.literal("EXPENSE_REVERSE"),
      expense_id: z.uuid(),
      amount: positiveMoney,
      reason: reasonSchema,
      confirmed: z.literal(true),
    })
    .strict(),
]);
export const financePermissions: Record<
  z.infer<typeof financeCommandSchema>["action"],
  string
> = {
  CHARGE: "charges.create",
  PAYMENT: "payments.confirm",
  ALLOCATE: "payments.confirm",
  DEPOSIT_RECEIVE: "deposits.manage",
  DEPOSIT_APPLY: "deposits.manage",
  DEPOSIT_UNAPPLY: "deposits.manage",
  REFUND: "refunds.create",
  ADJUST: "charges.create",
  EXPENSE: "expenses.write",
  EXPENSE_REVERSE: "expenses.write",
};
export const financeConfigurationSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("POLICY"),
      admin_discount_bps: z.number().int().min(0).max(10000),
      manager_discount_bps: z.number().int().min(0).max(10000),
      expected_version: z.number().int().min(0),
    })
    .strict(),
  z
    .object({
      kind: z.literal("METHOD"),
      id: reference,
      name: z.string().trim().min(1).max(100),
      active: z.boolean(),
      expected_updated_at: instantSchema.nullable(),
    })
    .strict(),
]);
export const registerKinds = [
  "CHARGES",
  "PAYMENTS",
  "DEPOSITS",
  "REFUNDS",
  "EXPENSES",
  "ADJUSTMENTS",
] as const;
export const registerLabels: Record<(typeof registerKinds)[number], string> = {
  CHARGES: "Contas a receber",
  PAYMENTS: "Recebimentos",
  DEPOSITS: "Cauções",
  REFUNDS: "Reembolsos",
  EXPENSES: "Despesas",
  ADJUSTMENTS: "Ajustes de cobranças",
};
export const financeFilterSchema = z
  .object({
    kind: z.enum(registerKinds).default("CHARGES"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    customer: z.preprocess(
      (v) => (v === "" ? null : v),
      reference.default(null),
    ),
    rental: z.preprocess((v) => (v === "" ? null : v), reference.default(null)),
  })
  .strict()
  .refine(
    (v) => v.kind !== "EXPENSES" || (!v.customer && !v.rental),
    "Despesas não usam filtro de cliente ou locação.",
  );
export const commandEnvelope = z
  .object({ input: z.unknown(), idempotency_key: idempotencySchema })
  .strict();
