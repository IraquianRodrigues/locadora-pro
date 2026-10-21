import "server-only";
import { z } from "zod";
import { requireStaff, AccessError } from "@/lib/auth/session";
import { authConfig } from "@/lib/auth/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { databaseError, RegistryError } from "@/lib/registry/service";
import { calculateQuote } from "@/lib/pricing/engine";
import { moneySchema } from "@/lib/pricing/policy";
import {
  bookingInputSchema,
  catalogSchema,
  idempotencySchema,
  requestInputSchema,
  decisionSchema,
  reservationStatuses,
} from "./schema";
import { lookupToken, tokenHash } from "./token";

function permission(permissions: string[], code: string) {
  if (!permissions.includes(code)) throw new AccessError(403);
}
const dbMoney = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v.toFixed(2) : v))
  .pipe(moneySchema);
const quoteSchema = z.object({
  id: z.uuid(),
  total: dbMoney,
  deposit: dbMoney,
  expires_at: z.string(),
  rules_snapshot: z.record(z.string(), z.unknown()),
  quote_items: z.array(
    z.object({
      id: z.uuid(),
      kind: z.string(),
      description: z.string(),
      quantity: z.coerce.string(),
      unit_amount: dbMoney,
      total: dbMoney,
    }),
  ),
});
export type QuoteView = z.infer<typeof quoteSchema>;
export async function getQuote(id: string): Promise<QuoteView> {
  const { client, staff } = await requireStaff("reservations.read");
  permission(staff.permissions, "pricing.read");
  const { data, error } = await client
    .from("quotes")
    .select(
      "id,total,deposit,expires_at,rules_snapshot,quote_items(id,kind,description,quantity,unit_amount,total)",
    )
    .eq("id", z.uuid().parse(id))
    .maybeSingle();
  if (error) databaseError(error);
  if (!data)
    throw new RegistryError(404, "NOT_FOUND", "Cotação não encontrada.");
  return quoteSchema.parse(data);
}
export async function createQuote(raw: unknown, key: unknown) {
  const { client, staff } = await requireStaff("reservations.request");
  permission(staff.permissions, "pricing.read");
  permission(staff.permissions, "reservations.read");
  const input = bookingInputSchema.parse(raw),
    idempotency_key = idempotencySchema.parse(key);
  const previous = await client.rpc("find_staff_quote_operation", {
    input,
    idempotency_key,
  });
  if (previous.error) databaseError(previous.error);
  if (previous.data)
    return getQuote(z.object({ id: z.uuid() }).parse(previous.data).id);
  const context = await client.rpc("staff_pricing_context", { input });
  if (context.error) databaseError(context.error);
  const catalog = catalogSchema.parse(context.data);
  let calculation: ReturnType<typeof calculateQuote>;
  try {
    calculation = calculateQuote(input, catalog, {
      canDiscount: staff.permissions.includes("discounts.authorize"),
      roles: staff.roles,
    });
  } catch (error) {
    throw new RegistryError(
      400,
      "INVALID_QUOTE",
      error instanceof Error
        ? error.message
        : "Não foi possível calcular a cotação.",
    );
  }
  const { data, error } = await createAdminClient().rpc("persist_staff_quote", {
    actor_id: staff.id,
    session_id: staff.sessionId,
    input,
    expected_fingerprint: catalog.fingerprint,
    calculation,
    idempotency_key,
  });
  if (error) databaseError(error);
  return getQuote(z.object({ id: z.uuid() }).parse(data).id);
}
export async function availability(raw: unknown) {
  const { client, staff } = await requireStaff("reservations.read");
  permission(staff.permissions, "vehicles.read");
  permission(staff.permissions, "pricing.read");
  const { data, error } = await client.rpc("staff_availability", {
    input: bookingInputSchema.parse(raw),
  });
  if (error) databaseError(error);
  return z
    .object({
      available: z.number().int().min(0),
      indicative: z.literal(true),
      occupied_until: z.string(),
    })
    .parse(data);
}
export async function requestReservation(raw: unknown) {
  const { client, staff } = await requireStaff("reservations.request");
  permission(staff.permissions, "pricing.read");
  const input = requestInputSchema.parse(raw);
  const token = lookupToken(
    authConfig().secret,
    staff.id,
    input.quote_id,
    input.idempotency_key,
  );
  const { data, error } = await client.rpc("request_staff_reservation", {
    quote_id: input.quote_id,
    customer_id: input.customer_id,
    token_hash: tokenHash(token),
    idempotency_key: input.idempotency_key,
  });
  if (error) databaseError(error);
  return {
    ...z.object({ id: z.uuid(), status: z.literal("REQUESTED") }).parse(data),
    lookup_token: token,
  };
}
const filtersSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    status: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.enum(reservationStatuses).optional(),
    ),
  })
  .strict();
export async function listReservations(raw: unknown) {
  const { client } = await requireStaff("reservations.read"),
    filters = filtersSchema.parse(raw);
  let query = client
    .from("reservations")
    .select("id,status,start_at,end_at,expires_at,version", { count: "exact" });
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range((filters.page - 1) * 20, filters.page * 20 - 1);
  if (error) databaseError(error);
  return {
    data: z
      .array(
        z.object({
          id: z.uuid(),
          status: z.enum(reservationStatuses),
          start_at: z.string(),
          end_at: z.string(),
          expires_at: z.string().nullable(),
          version: z.number().int(),
        }),
      )
      .parse(data),
    meta: { page: filters.page, total: count ?? 0, pageSize: 20 },
  };
}
export async function getReservation(id: string) {
  const { client, staff } = await requireStaff("reservations.read");
  z.uuid().parse(id);
  const { data, error } = await client
    .from("reservations")
    .select(
      "id,customer_id,branch_id,quote_id,status,start_at,end_at,expires_at,version,reservation_items(category_id,vehicle_id),reservation_locations(direction,mode,address_snapshot,fee,scheduled_at,instructions),reservation_status_history(id,from_status,to_status,reason,created_at),vehicle_allocations(vehicle_id,released_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) databaseError(error);
  if (!data)
    throw new RegistryError(404, "NOT_FOUND", "Reserva não encontrada.");
  const reservation = z
    .object({
      id: z.uuid(),
      customer_id: z.uuid(),
      branch_id: z.uuid(),
      quote_id: z.uuid(),
      status: z.enum(reservationStatuses),
      start_at: z.string(),
      end_at: z.string(),
      expires_at: z.string().nullable(),
      version: z.number().int(),
      // FK UNIQUE: PostgREST embute a relação 1:1 como objeto. A saída do serviço é sempre lista.
      reservation_items: z.preprocess(
        (value) => (Array.isArray(value) ? value : value ? [value] : []),
        z
          .array(
            z.object({
              category_id: z.uuid().nullable(),
              vehicle_id: z.uuid().nullable(),
            }),
          )
          .length(1),
      ),
      reservation_locations: z.array(
        z.object({
          direction: z.string(),
          mode: z.string(),
          address_snapshot: z.record(z.string(), z.unknown()),
          fee: z.coerce.string(),
          scheduled_at: z.string(),
          instructions: z.string().nullable(),
        }),
      ),
      reservation_status_history: z.array(
        z.object({
          id: z.uuid(),
          from_status: z.string().nullable(),
          to_status: z.string(),
          reason: z.string().nullable(),
          created_at: z.string(),
        }),
      ),
      vehicle_allocations: z.array(
        z.object({ vehicle_id: z.uuid(), released_at: z.string().nullable() }),
      ),
    })
    .parse(data);
  let submission: Record<string, unknown> | null = null;
  if (staff.permissions.includes("customers.read")) {
    const result = await client
      .from("public_reservation_submissions")
      .select("customer_data,terms_version,terms_snapshot,accepted_at")
      .eq("reservation_id", id)
      .maybeSingle();
    if (result.error) databaseError(result.error);
    submission = result.data
      ? z
          .object({
            customer_data: z.record(z.string(), z.unknown()),
            terms_version: z.uuid(),
            terms_snapshot: z.record(z.string(), z.unknown()),
            accepted_at: z.string(),
          })
          .parse(result.data)
      : null;
  }
  return {
    ...reservation,
    submission,
    analysis_expired:
      !!reservation.expires_at &&
      Date.parse(reservation.expires_at) <= Date.now(),
  };
}
export async function decideReservation(id: string, raw: unknown) {
  const { client, staff } = await requireStaff("reservations.read");
  const input = decisionSchema.parse(raw);
  if (input.target === "CONFIRMED" || input.target === "REJECTED")
    permission(staff.permissions, "reservations.approve");
  else if (input.target === "UNDER_REVIEW")
    permission(staff.permissions, "reservations.review");
  else if (
    !staff.permissions.some((p) =>
      ["reservations.cancel_pending", "reservations.cancel_confirmed"].includes(
        p,
      ),
    )
  )
    throw new AccessError(403);
  const { data, error } = await client.rpc("decide_staff_reservation", {
    reservation_id: z.uuid().parse(id),
    expected_version: input.expected_version,
    target_status: input.target,
    reason: input.reason,
    idempotency_key: input.idempotency_key,
  });
  if (error) databaseError(error);
  return z
    .object({ id: z.uuid(), status: z.enum(reservationStatuses) })
    .parse(data);
}
export async function expireReservations() {
  await requireStaff("reservations.approve");
  const { data, error } = await createAdminClient().rpc(
    "expire_pending_reservations",
    { batch_size: 100 },
  );
  if (error) databaseError(error);
  return z.number().int().min(0).parse(data);
}
