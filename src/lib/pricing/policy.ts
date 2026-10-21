import { z } from "zod";
export const moneySchema = z
  .string()
  .trim()
  .transform((v) => v.replace(",", "."))
  .pipe(
    z
      .string()
      .regex(
        /^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$/,
        "Informe um valor de até 10 dígitos e duas casas decimais.",
      ),
  )
  .transform((v) => {
    const [a, b = ""] = v.split(".");
    return `${a}.${b.padEnd(2, "0")}`;
  });
const optionalMoney = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  moneySchema.nullable(),
);
const optionalId = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.uuid().nullable(),
);
const optionalInteger = z.preprocess(
  (v) =>
    v === "" || v === undefined || (typeof v === "number" && Number.isNaN(v))
      ? null
      : v,
  z.number().int().min(1).max(366).nullable(),
);
const integer = (min: number, max: number) =>
  z
    .number({ error: "Informe um número." })
    .int("Use um número inteiro.")
    .min(min)
    .max(max);
const timezone = z
  .string()
  .min(1)
  .refine((v) => {
    try {
      if (/^[+-]/.test(v)) return false;
      new Intl.DateTimeFormat("pt-BR", { timeZone: v }).format();
      return true;
    } catch {
      return false;
    }
  }, "Informe um timezone IANA válido.");
export const policySchema = z
  .object({
    engine: z.literal("v1"),
    timezone,
    duration_basis: z.enum(["ELAPSED", "LOCAL_DAYS"]),
    strategy: z.enum(["CEIL_PERIOD", "DAY_HOUR", "WEEK_DAY_HOUR"]),
    minimum_periods: integer(1, 10000),
    tolerance_minutes: integer(0, 1440),
    hour_increment_minutes: z.union([
      z.literal(15),
      z.literal(30),
      z.literal(60),
    ]),
    rounding: z.enum(["HALF_UP", "CEIL", "TRUNCATE"]),
    week_amount: optionalMoney,
    day_amount: optionalMoney,
    hour_amount: optionalMoney,
    deposit_amount: moneySchema,
    delivery_enabled: z.boolean(),
    delivery_amount: moneySchema,
    collection_enabled: z.boolean(),
    collection_amount: moneySchema,
    discount_scope: z.enum(["RENTAL", "RENTAL_AND_SERVICES"]),
    admin_discount_bps: integer(0, 10000),
    manager_discount_bps: integer(0, 10000),
    turnaround_minutes: integer(0, 1440),
    quote_validity_minutes: integer(5, 10080),
    request_validity_minutes: integer(5, 43200),
    lookup_validity_days: integer(1, 365),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.strategy !== "CEIL_PERIOD" && (!v.day_amount || !v.hour_amount))
      c.addIssue({
        code: "custom",
        path: ["day_amount"],
        message:
          "Pacotes com excedentes exigem valores explícitos de dia e hora.",
      });
    if (v.strategy === "WEEK_DAY_HOUR" && !v.week_amount)
      c.addIssue({
        code: "custom",
        path: ["week_amount"],
        message: "Configure o preço da semana excedente.",
      });
  });
export type PricingPolicy = z.infer<typeof policySchema>;
export const planInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    period_unit: z.enum(["DAY", "WEEK", "MONTH"]),
    month_mode: z.preprocess(
      (v) => (v === "" || v === undefined ? null : v),
      z.enum(["COMMERCIAL", "CALENDAR"]).nullable(),
    ),
    commercial_month_days: optionalInteger,
    active: z.boolean(),
    public_enabled: z.boolean().default(false),
    ...policySchema.shape,
  })
  .omit({ engine: true })
  .strict()
  .superRefine((v, c) => {
    if (v.period_unit === "MONTH" && !v.month_mode)
      c.addIssue({
        code: "custom",
        path: ["month_mode"],
        message: "Defina mês calendário ou comercial.",
      });
    if (
      v.period_unit !== "MONTH" &&
      (v.month_mode !== null || v.commercial_month_days !== null)
    )
      c.addIssue({
        code: "custom",
        path: ["month_mode"],
        message: "Modo mensal só se aplica a plano mensal.",
      });
    if ((v.month_mode === "COMMERCIAL") !== (v.commercial_month_days !== null))
      c.addIssue({
        code: "custom",
        path: ["commercial_month_days"],
        message:
          "Mês comercial exige quantidade de dias; calendário deixa esse campo vazio.",
      });
    const raw = Object.fromEntries(
      Object.entries(v).filter(
        ([key]) =>
          ![
            "name",
            "period_unit",
            "month_mode",
            "commercial_month_days",
            "active",
            "public_enabled",
          ].includes(key),
      ),
    );
    const parsed = policySchema.safeParse({ ...raw, engine: "v1" });
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        c.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
  })
  .transform(
    ({
      name,
      period_unit,
      month_mode,
      commercial_month_days,
      active,
      public_enabled,
      ...raw
    }) => ({
      name,
      period_unit,
      month_mode,
      commercial_month_days,
      active,
      public_enabled,
      policy: policySchema.parse({ ...raw, engine: "v1" }),
    }),
  );
export const priceInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    rate_plan_id: z.uuid(),
    category_id: optionalId,
    vehicle_id: optionalId,
    valid_from: z.iso.datetime({ offset: true }),
    valid_to: z.iso.datetime({ offset: true }),
    amount: moneySchema,
  })
  .strict()
  .superRefine((v, c) => {
    if (Number(!!v.category_id) + Number(!!v.vehicle_id) !== 1)
      c.addIssue({
        code: "custom",
        path: ["category_id"],
        message: "Escolha uma categoria ou um veículo, exclusivamente.",
      });
    if (new Date(v.valid_to) <= new Date(v.valid_from))
      c.addIssue({
        code: "custom",
        path: ["valid_to"],
        message: "Fim da vigência deve ser posterior ao início.",
      });
  })
  .transform(({ valid_from, valid_to, ...rest }) => ({
    ...rest,
    validity: `["${new Date(valid_from).toISOString()}","${new Date(valid_to).toISOString()}")`,
  }));
export const addonInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    unit: z.enum(["ONCE", "DAY", "WEEK", "MONTH", "HOUR"]),
    amount: moneySchema,
    active: z.boolean(),
    public_enabled: z.boolean().default(false),
  })
  .strict();
