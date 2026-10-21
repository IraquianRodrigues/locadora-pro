import { z } from "zod";
import {
  planInputSchema,
  priceInputSchema,
  addonInputSchema,
} from "@/lib/pricing/policy";
import {
  brazilToday,
  normalizeDocument,
  normalizePhone,
  states,
  validCivilDate,
  validCnpj,
  validCpf,
  validPhone,
} from "./brazil";

export const resources = [
  "categorias",
  "frota",
  "clientes",
  "condutores",
  "unidades",
  "planos",
  "precos",
  "adicionais",
] as const;
export const resourceSchema = z.enum(resources);
export type Resource = z.infer<typeof resourceSchema>;
const text = (max = 120) =>
  z
    .string()
    .trim()
    .min(1, "Campo obrigatório.")
    .max(max, `Use até ${max} caracteres.`);
const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => v || null);
const integer = (min: number, max: number) =>
  z.number({ error: "Informe um número." }).int().min(min).max(max);
const civilDate = z.string().refine(validCivilDate, "Informe uma data válida.");
const optionalDate = z
  .union([z.literal(""), civilDate, z.null()])
  .optional()
  .transform((v) => v || null);
const features = z
  .union([
    z
      .string()
      .max(1500)
      .transform((v) =>
        v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    z.array(text(80)).max(30),
  ])
  .pipe(z.array(text(80)).max(30))
  .transform((v) => [...new Set(v)]);
export const addressSchema = z
  .object({
    postal_code: z
      .string()
      .trim()
      .transform((v) => v.replace(/[-\s]/g, ""))
      .pipe(z.string().regex(/^\d{8}$/, "Informe um CEP com 8 dígitos.")),
    street: text(160),
    number: text(20),
    district: text(100),
    city: text(100),
    state: z.enum(states, { error: "Escolha uma UF válida." }),
    complement: optionalText(160),
  })
  .strict();
const addressFields = addressSchema.shape;
export const categorySchema = z
  .object({
    name: text(),
    description: z.string().trim().max(5000),
    capacity: integer(1, 100),
    features,
    active: z.boolean(),
  })
  .strict();
export const vehicleSchema = z
  .object({
    category_id: z.uuid("Escolha uma categoria."),
    branch_id: z.uuid("Escolha uma unidade."),
    plate: z
      .string()
      .trim()
      .toUpperCase()
      .transform((v) => v.replace(/[-\s]/g, ""))
      .pipe(
        z
          .string()
          .regex(
            /^[A-Z]{3}\d[A-Z0-9]\d{2}$/,
            "Placa inválida (padrão antigo ou Mercosul).",
          ),
      ),
    chassis: optionalText(17).refine(
      (v) => !v || /^[A-HJ-NPR-Z0-9]{17}$/.test(v),
      "Chassi deve ter 17 caracteres, sem I, O e Q.",
    ),
    renavam: optionalText(11).refine(
      (v) => !v || /^\d{9,11}$/.test(v),
      "RENAVAM deve ter de 9 a 11 dígitos.",
    ),
    make: text(80),
    model: text(100),
    version: z.string().trim().max(100),
    manufacture_year: integer(1900, 2200),
    model_year: integer(1900, 2200),
    color: text(60),
    fuel: z.enum([
      "FLEX",
      "GASOLINE",
      "ETHANOL",
      "DIESEL",
      "ELECTRIC",
      "HYBRID",
      "CNG",
    ]),
    transmission: z.enum(["MANUAL", "AUTOMATIC", "CVT"]),
    passengers: integer(1, 100),
    doors: integer(0, 10),
    mileage: integer(0, 999999999),
    description: z.string().trim().max(5000),
    features,
    operational_status: z.enum([
      "ACTIVE",
      "INACTIVE",
      "MAINTENANCE",
      "RETIRED",
    ]),
    acquired_on: optionalDate,
    internal_notes: optionalText(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.model_year < v.manufacture_year ||
      v.model_year > v.manufacture_year + 2
    )
      c.addIssue({
        code: "custom",
        path: ["model_year"],
        message: "Ano do modelo deve estar entre fabricação e fabricação + 2.",
      });
  });
export const customerSchema = z
  .object({
    person_type: z.enum(["PF", "PJ"]),
    name: text(200),
    tax_document: z.string().max(30).transform(normalizeDocument),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email("E-mail inválido.").max(254)),
    phone: z
      .string()
      .max(30)
      .transform(normalizePhone)
      .refine(validPhone, "Informe telefone brasileiro com DDD válido."),
    ...addressFields,
    birth_date: optionalDate,
    notes: optionalText(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      !(v.person_type === "PF"
        ? validCpf(v.tax_document)
        : validCnpj(v.tax_document))
    )
      c.addIssue({
        code: "custom",
        path: ["tax_document"],
        message: v.person_type === "PF" ? "CPF inválido." : "CNPJ inválido.",
      });
    if (
      v.birth_date &&
      (v.person_type === "PJ" || v.birth_date > brazilToday())
    )
      c.addIssue({
        code: "custom",
        path: ["birth_date"],
        message: "Data deve ser passada e somente para pessoa física.",
      });
  })
  .transform(
    ({
      postal_code,
      street,
      number,
      district,
      city,
      state,
      complement,
      ...rest
    }) => ({
      ...rest,
      address: {
        postal_code,
        street,
        number,
        district,
        city,
        state,
        complement,
      },
    }),
  );
export const driverSchema = z
  .object({
    customer_id: z.uuid("Escolha um cliente."),
    name: text(200),
    cpf: z
      .string()
      .max(20)
      .transform(normalizeDocument)
      .refine(validCpf, "CPF inválido."),
    license_number: z
      .string()
      .trim()
      .regex(/^\d{11}$/, "CNH deve ter 11 dígitos.")
      .refine((v) => !/^(\d)\1+$/.test(v), "CNH inválida."),
    license_category: z.enum([
      "ACC",
      "A",
      "B",
      "C",
      "D",
      "E",
      "AB",
      "AC",
      "AD",
      "AE",
    ]),
    license_expires_on: civilDate,
  })
  .strict();
export const branchSchema = z
  .object({ name: text(), active: z.boolean(), ...addressFields })
  .strict()
  .transform(({ name, active, ...address }) => ({ name, active, address }));
export const schemas = {
  categorias: categorySchema,
  frota: vehicleSchema,
  clientes: customerSchema,
  condutores: driverSchema,
  unidades: branchSchema,
  planos: planInputSchema,
  precos: priceInputSchema,
  adicionais: addonInputSchema,
};
export const recordId = z.uuid();
export const revisionSchema = z.iso.datetime({ offset: true });
export const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  q: z.string().trim().max(100).default(""),
  archived: z.enum(["false", "true"]).default("false"),
  category: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.uuid().optional(),
  ),
  status: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE", "RETIRED"]).optional(),
  ),
});
export type MutationResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fields?: Record<string, string> };
