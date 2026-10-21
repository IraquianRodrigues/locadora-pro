import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { authConfigured } from "./config";
import { staffSchema, type Staff } from "./schema";
import { canAccess } from "./security";

export class AccessError extends Error {
  constructor(public status: 401 | 403 | 503) {
    super("Acesso não autorizado.");
  }
}
export async function verifiedStaff(client: SupabaseClient): Promise<Staff> {
  const { data, error } = await client.auth.getUser();
  if (
    error &&
    ((error.status ?? 0) >= 500 ||
      error.status === 429 ||
      error.name === "AuthRetryableFetchError")
  )
    throw new AccessError(503);
  if (error || !data.user) throw new AccessError(401);
  const result = await client.rpc("staff_context");
  if (result.error) throw new AccessError(503);
  const parsed = staffSchema.safeParse(result.data);
  if (!parsed.success || parsed.data.id !== data.user.id)
    throw new AccessError(403);
  return parsed.data;
}
export async function requireStaff(permission?: string) {
  if (!authConfigured()) throw new AccessError(503);
  const client = await createClient();
  const staff = await verifiedStaff(client);
  if (!canAccess(staff.permissions, permission)) throw new AccessError(403);
  return { client, staff };
}
export async function requirePageStaff(permission?: string) {
  try {
    return await requireStaff(permission);
  } catch (error) {
    if (error instanceof AccessError)
      redirect(error.status === 403 ? "/acesso-negado" : "/login");
    throw error;
  }
}
