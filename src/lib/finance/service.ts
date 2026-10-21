import "server-only";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { databaseError, RegistryError } from "@/lib/registry/service";
import { idempotencySchema } from "@/lib/reservations/schema";
import {
  financeCommandSchema,
  financePermissions,
  financeConfigurationSchema,
  financeFilterSchema,
} from "./schema";
export async function financeCommand(raw: unknown, key: unknown) {
  const input = financeCommandSchema.parse(raw),
    { client } = await requireStaff(financePermissions[input.action]);
  const { data, error } = await client.rpc("finance_command", {
    input,
    idempotency_key: idempotencySchema.parse(key),
  });
  if (error) {
    if (error.code === "23514")
      throw new RegistryError(
        409,
        "FINANCE_RULE",
        "Confira os saldos disponíveis, a confirmação de recebimento e os limites configurados. Nenhum lançamento parcial desta operação foi salvo.",
      );
    databaseError(error);
  }
  return z.object({ id: z.uuid() }).parse(data);
}
export async function configureFinance(raw: unknown, key: unknown) {
  const { client } = await requireStaff("settings.manage"),
    input = financeConfigurationSchema.parse(raw);
  const r = await client.rpc("finance_configuration", {
    input,
    idempotency_key: idempotencySchema.parse(key),
  });
  if (r.error) databaseError(r.error);
  return z.object({ id: z.uuid() }).parse(r.data);
}
const option = z.object({ id: z.uuid(), name: z.string() });
const optionsSchema = z.object({
  customers: z.array(option),
  vehicles: z.array(option),
  rentals: z.array(
    z.object({
      id: z.uuid(),
      customer_id: z.uuid(),
      vehicle_id: z.uuid(),
      status: z.string(),
    }),
  ),
  methods: z.array(option),
});
export type FinanceOptions = z.infer<typeof optionsSchema>;
export async function financeOptions(search = "") {
  const { client } = await requireStaff("finance.read");
  const r = await client.rpc("finance_options", {
    search: z.string().trim().max(100).parse(search),
  });
  if (r.error) databaseError(r.error);
  return optionsSchema.parse(r.data);
}
export const registerRowSchema = z.record(z.string(), z.unknown());
export type RegisterRow = z.infer<typeof registerRowSchema>;
export async function financeRegister(raw: unknown) {
  const { client } = await requireStaff("finance.read"),
    filters = financeFilterSchema.parse(raw);
  const r = await client.rpc("finance_register", filters);
  if (r.error) databaseError(r.error);
  return z
    .object({
      rows: z.array(registerRowSchema),
      page: z.number().int(),
      page_size: z.number().int(),
      total: z.number().int(),
    })
    .parse(r.data);
}
export async function financeConfiguration() {
  const { client } = await requireStaff("settings.manage");
  const [methods, policy] = await Promise.all([
    client
      .from("payment_methods")
      .select("id,name,active,updated_at")
      .order("name"),
    client
      .from("system_settings")
      .select("value,version")
      .eq("key", "finance_policy")
      .maybeSingle(),
  ]);
  if (methods.error) databaseError(methods.error);
  if (policy.error) databaseError(policy.error);
  return {
    methods: z
      .array(
        z.object({
          id: z.uuid(),
          name: z.string(),
          active: z.boolean(),
          updated_at: z.string(),
        }),
      )
      .parse(methods.data),
    policy: policy.data
      ? z
          .object({
            value: z.object({
              admin_discount_bps: z.number(),
              manager_discount_bps: z.number(),
            }),
            version: z.number(),
          })
          .parse(policy.data)
      : null,
  };
}
