import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseEnvironment } from "@/config/env";
import { databaseError, RegistryError } from "@/lib/registry/service";
import { catalogFilters, siteSchema } from "./schema";
export function publicClient() {
  const { url, key } = requireSupabaseEnvironment();
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
export async function publicRPC(name: string, args?: Record<string, unknown>) {
  const { data, error } = await publicClient().rpc(name, args);
  if (error) databaseError(error);
  return data as unknown;
}
export async function getSite() {
  const data = await publicRPC("public_site");
  if (!data)
    throw new RegistryError(
      503,
      "PUBLIC_UNAVAILABLE",
      "Atendimento online em preparação.",
    );
  return siteSchema.parse(data);
}
const option = z.object({ id: z.uuid(), name: z.string() });
export const optionsSchema = z.object({
  branches: z.array(option),
  categories: z.array(
    option.extend({ description: z.string(), capacity: z.number() }),
  ),
  plans: z.array(option.extend({ unit: z.string(), timezone: z.string() })),
  services: z.array(option.extend({ unit: z.string(), amount: z.string() })),
});
export async function bookingOptions() {
  const data = await publicRPC("public_booking_options");
  if (!data)
    throw new RegistryError(
      503,
      "PUBLIC_UNAVAILABLE",
      "Atendimento online em preparação.",
    );
  return optionsSchema.parse(data);
}
export const vehicleView = z.object({
  id: z.uuid(),
  category_id: z.uuid(),
  category: z.string(),
  branch_id: z.uuid(),
  branch: z.string(),
  make: z.string(),
  model: z.string(),
  version: z.string(),
  model_year: z.number(),
  passengers: z.number(),
  doors: z.number(),
  fuel: z.string(),
  transmission: z.string(),
  description: z.string(),
  features: z.array(z.string()),
  image_id: z.uuid().nullable(),
});
export async function getCatalog(raw: unknown = {}, id?: string) {
  const filters = catalogFilters.parse(raw);
  if (id) z.uuid().parse(id);
  const data = await publicRPC("public_catalog", {
    filters,
    vehicle_id: id ?? null,
  });
  if (!data)
    throw new RegistryError(
      503,
      "PUBLIC_UNAVAILABLE",
      "Catálogo em preparação.",
    );
  return z
    .object({
      data: z.array(vehicleView),
      meta: z.object({
        page: z.number(),
        pageSize: z.literal(24),
        total: z.number(),
      }),
    })
    .parse(data);
}
