import { z } from "zod";
import { addressSchema, customerSchema } from "@/lib/registry/schema";
import {
  bookingInputSchema,
  idempotencySchema,
} from "@/lib/reservations/schema";
export const siteSchema = z
  .object({
    enabled: z.boolean(),
    name: z.string().trim().min(1).max(120),
    email: z.email().max(254),
    phone: z.string().regex(/^\d{10,11}$/),
    address: z.string().trim().min(5).max(500),
    terms: z.string().trim().min(30).max(20000),
    privacy: z.string().trim().min(30).max(20000),
    terms_version: z.uuid(),
  })
  .strict();
export type PublicSite = z.infer<typeof siteSchema>;
export const publicInputSchema = z
  .object({
    rate_plan_id: z.uuid(),
    branch_id: z.uuid(),
    vehicle_id: z.uuid().nullable(),
    category_id: z.uuid().nullable(),
    start_at: z.iso.datetime({ offset: true }),
    end_at: z.iso.datetime({ offset: true }),
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
  })
  .strict()
  .transform((v): z.input<typeof bookingInputSchema> => ({
    ...v,
    customer_id: null,
    discount_amount: "0.00",
    discount_reason: "",
  }))
  .pipe(bookingInputSchema);
export const publicCustomerSchema = z
  .object({
    person_type: z.enum(["PF", "PJ"]),
    name: z.string(),
    tax_document: z.string(),
    email: z.string(),
    phone: z.string(),
    birth_date: z.string().nullable(),
    ...addressSchema.shape,
  })
  .strict()
  .transform((v): z.input<typeof customerSchema> => ({ ...v, notes: "" }))
  .pipe(customerSchema);
const spam = {
  captcha: z.string().max(2048),
  website: z.string().max(200).default(""),
  idempotency_key: idempotencySchema,
};
export const publicQuoteSchema = z
  .object({ input: publicInputSchema, ...spam })
  .strict();
export const publicRequestSchema = z
  .object({
    quote_id: z.uuid(),
    customer: publicCustomerSchema,
    terms_version: z.uuid(),
    accepted: z.literal(true),
    ...spam,
  })
  .strict();
export const catalogFilters = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    q: z.string().trim().max(100).default(""),
    category: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.uuid().optional(),
    ),
    branch: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.uuid().optional(),
    ),
  })
  .strict();
export const publicQuoteView = z.object({
  id: z.uuid(),
  total: z.string(),
  deposit: z.string(),
  expires_at: z.string(),
  available: z.number().int().min(0).optional(),
  items: z.array(
    z.object({
      kind: z.string(),
      description: z.string(),
      quantity: z.string(),
      total: z.string(),
    }),
  ),
});
export type PublicQuote = z.infer<typeof publicQuoteView>;
