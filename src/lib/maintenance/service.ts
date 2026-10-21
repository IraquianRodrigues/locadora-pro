import "server-only";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { databaseError, RegistryError } from "@/lib/registry/service";
import { idempotencySchema } from "@/lib/reservations/schema";
import { maintenanceCommandSchema, maintenanceFilters } from "./schema";
export async function maintenanceVehicles(search = "") {
  const { client } = await requireStaff("vehicles.read");
  const term = z
    .string()
    .trim()
    .max(20)
    .regex(/^[a-zA-Z0-9]*$/)
    .parse(search);
  let query = client
    .from("vehicles")
    .select("id,plate,make,model")
    .is("archived_at", null)
    .neq("operational_status", "RETIRED");
  if (term) query = query.ilike("plate", `%${term}%`);
  const r = await query.order("plate").limit(100);
  if (r.error) databaseError(r.error);
  return z
    .array(
      z.object({
        id: z.uuid(),
        plate: z.string(),
        make: z.string(),
        model: z.string(),
      }),
    )
    .parse(r.data)
    .map((v) => ({ id: v.id, name: `${v.plate} · ${v.make} ${v.model}` }));
}
export async function maintenanceCommand(raw: unknown, key: unknown) {
  const { client } = await requireStaff("maintenance.write"),
    input = maintenanceCommandSchema.parse(raw);
  const r = await client.rpc("maintenance_command", {
    input,
    idempotency_key: idempotencySchema.parse(key),
  });
  if (r.error) {
    if (["23P01", "23514"].includes(r.error.code))
      throw new RegistryError(
        409,
        "MAINTENANCE_CONFLICT",
        "Confira os compromissos do veículo, a janela de execução e a quilometragem. A operação foi desfeita integralmente.",
      );
    databaseError(r.error);
  }
  return z
    .object({ id: z.uuid(), version: z.number(), status: z.string() })
    .parse(r.data);
}
const rowSchema = z.object({
  id: z.uuid(),
  vehicle_id: z.uuid(),
  kind: z.string(),
  status: z.string(),
  mileage: z.coerce.number(),
  start_at: z.string(),
  end_at: z.string(),
  actual_start_at: z.string().nullable(),
  actual_end_at: z.string().nullable(),
  blocks_availability: z.boolean(),
  description: z.string(),
  next_due_on: z.string().nullable(),
  next_due_mileage: z.coerce.number().nullable(),
  version: z.number(),
});
export type MaintenanceView = z.infer<typeof rowSchema>;
const columns =
  "id,vehicle_id,kind,status,mileage,start_at,end_at,actual_start_at,actual_end_at,blocks_availability,description,next_due_on,next_due_mileage,version";
export async function listMaintenance(raw: unknown) {
  const { client } = await requireStaff("maintenance.read"),
    filters = maintenanceFilters.parse(raw);
  let query = client
    .from("maintenance_records")
    .select(columns, { count: "exact" });
  if (filters.status) query = query.eq("status", filters.status);
  const r = await query
    .order("start_at", { ascending: false })
    .order("id")
    .range((filters.page - 1) * 20, filters.page * 20 - 1);
  if (r.error) databaseError(r.error);
  return {
    rows: z.array(rowSchema).parse(r.data),
    total: r.count ?? 0,
    page: filters.page,
  };
}
export async function getMaintenance(id: string) {
  const { client } = await requireStaff("maintenance.read");
  z.uuid().parse(id);
  const r = await client
    .from("maintenance_records")
    .select(columns)
    .eq("id", id)
    .maybeSingle();
  if (r.error) databaseError(r.error);
  if (!r.data)
    throw new RegistryError(404, "NOT_FOUND", "Manutenção não encontrada.");
  const events = await client
    .from("maintenance_events")
    .select("id,event_type,created_at,detail")
    .eq("maintenance_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (events.error) databaseError(events.error);
  return {
    record: rowSchema.parse(r.data),
    events: z
      .array(
        z.object({
          id: z.uuid(),
          event_type: z.string(),
          created_at: z.string(),
          detail: z.record(z.string(), z.unknown()),
        }),
      )
      .parse(events.data),
  };
}
export async function maintenanceAlerts() {
  const { client } = await requireStaff("maintenance.read");
  const r = await client.rpc("maintenance_alerts");
  if (r.error) databaseError(r.error);
  return z
    .object({
      due: z.array(
        z.object({
          id: z.uuid(),
          vehicle_id: z.uuid(),
          kind: z.string(),
          next_due_on: z.string().nullable(),
          next_due_mileage: z.coerce.number().nullable(),
          current_mileage: z.coerce.number(),
        }),
      ),
      unfinished: z.array(
        z.object({
          id: z.uuid(),
          vehicle_id: z.uuid(),
          kind: z.string(),
          status: z.string(),
          end_at: z.string(),
        }),
      ),
    })
    .parse(r.data);
}
