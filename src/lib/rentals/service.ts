import "server-only";
import { z } from "zod";
import { requireStaff, AccessError } from "@/lib/auth/session";
import {
  RegistryError,
  databaseError as baseDatabaseError,
} from "@/lib/registry/service";
import { idempotencySchema } from "@/lib/reservations/schema";
import {
  commandSchema,
  commandPermissions,
  createRentalSchema,
  setupSchema,
  extensionSchema,
  checklistSchema,
} from "./schema";
function databaseError(
  error: { code?: string; message?: string } | null,
): never {
  const messages: Record<string, string> = {
    "Configure rental operations first":
      "Configure as regras de locação em Regras e modelos antes de criar a locação.",
    "Configure company identity first":
      "Preencha a identidade e o endereço da locadora em Regras e modelos.",
    "Complete initial inspection and select drivers first":
      "Vincule os condutores e conclua a vistoria inicial antes de solicitar o contrato.",
    "Incomplete checklist, photos or mileage":
      "Confira todas as respostas, fotos obrigatórias e a quilometragem da vistoria.",
    "Required documents missing":
      "Anexe e confirme os documentos do cliente, veículo e condutores antes da retirada.",
    "Revalidate drivers":
      "Confira os condutores e suas CNHs e vincule-os novamente antes da retirada.",
    "Initial inspection required":
      "Conclua uma vistoria inicial com quilometragem atualizada.",
    "Current generated contract required":
      "Solicite e gere um contrato com os dados atuais antes da retirada.",
    "Record pickup logistics first":
      "Registre a execução da retirada antes de confirmá-la.",
    "Record return logistics first":
      "Registre a execução da devolução antes de confirmá-la.",
    "Confirmed payment required":
      "O financeiro precisa confirmar a quitação da locação antes da retirada.",
    "Confirmed deposit required":
      "O financeiro precisa confirmar o recebimento da caução exigida.",
    "Final inspection required":
      "Conclua a vistoria final antes de confirmar a devolução.",
    "Assess return damages before closing":
      "Solicite a avaliação das avarias da devolução antes do fechamento.",
    "Vehicle still in use or outside checkout window":
      "O veículo ainda está em uso ou a retirada está fora do período contratado.",
    "Extension requires same vehicle/branch, no repeat deposit or logistics":
      "Use uma cotação para o mesmo veículo e unidade, sem nova caução ou taxas de logística.",
    "Resolve confirmed financial entries before cancellation":
      "Recebimentos e cauções confirmados exigem tratamento pelo financeiro antes do cancelamento.",
  };
  if (error?.code === "23514" && error.message && messages[error.message])
    throw new RegistryError(
      409,
      "RENTAL_PREREQUISITE",
      messages[error.message],
    );
  return baseDatabaseError(error);
}
export async function createRental(raw: unknown, key: unknown) {
  const { client } = await requireStaff("rentals.create");
  const input = createRentalSchema.parse(raw);
  const { data, error } = await client.rpc("create_rental", {
    input,
    idempotency_key: idempotencySchema.parse(key),
  });
  if (error) databaseError(error);
  return z.object({ id: z.uuid(), status: z.literal("PREPARING") }).parse(data);
}
export async function commandRental(raw: unknown, key: unknown) {
  const input = commandSchema.parse(raw);
  const { client } = await requireStaff(commandPermissions[input.action]);
  const { data, error } = await client.rpc(
    input.action === "CANCEL" ? "cancel_settled_rental" : "rental_command",
    {
      input,
      idempotency_key: idempotencySchema.parse(key),
    },
  );
  if (error) databaseError(error);
  return z
    .object({
      id: z.uuid(),
      status: z.string(),
      version: z.number(),
      contract_id: z.uuid().optional(),
      inspection_id: z.uuid().optional(),
      awaiting_payment: z.boolean().optional(),
    })
    .parse(data);
}
export async function extendRental(raw: unknown, key: unknown) {
  const { client } = await requireStaff("rentals.extend");
  const input = extensionSchema.parse(raw);
  const { data, error } = await client.rpc("extend_rental", {
    ...input,
    idempotency_key: idempotencySchema.parse(key),
  });
  if (error) databaseError(error);
  return z
    .object({
      id: z.uuid(),
      end_at: z.string(),
      contract_id: z.uuid().optional(),
    })
    .parse(data);
}
export async function setupRentals(raw: unknown, key: unknown) {
  const { client } = await requireStaff("settings.manage");
  const input = setupSchema.parse(raw);
  const { data, error } = await client.rpc("rental_setup", {
    input,
    idempotency_key: idempotencySchema.parse(key),
  });
  if (error) databaseError(error);
  return data as { id: string | null };
}
const listSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    status: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z
        .enum(["PREPARING", "ACTIVE", "OVERDUE", "COMPLETED", "CANCELLED"])
        .optional(),
    ),
  })
  .strict();
export async function listRentals(raw: unknown) {
  const { client } = await requireStaff("rentals.read"),
    filters = listSchema.parse(raw);
  let query = client
    .from("rentals")
    .select("id,status,start_at,end_at,version,vehicle_id", { count: "exact" });
  if (filters.status) query = query.eq("status", filters.status);
  const result = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range((filters.page - 1) * 20, filters.page * 20 - 1);
  if (result.error) databaseError(result.error);
  return {
    data: z
      .array(
        z.object({
          id: z.uuid(),
          status: z.string(),
          start_at: z.string(),
          end_at: z.string(),
          version: z.number(),
          vehicle_id: z.uuid(),
        }),
      )
      .parse(result.data)
      .map((r) => ({
        ...r,
        overdue:
          ["ACTIVE", "OVERDUE"].includes(r.status) &&
          Date.parse(r.end_at) < Date.now(),
      })),
    page: filters.page,
    total: result.count ?? 0,
  };
}
const json = z.record(z.string(), z.unknown());
export const inspectionViewSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["INITIAL", "FINAL"]),
  mileage: z.coerce.number(),
  fuel: z.coerce.number(),
  notes: z.string().nullable(),
  completed_at: z.string().nullable(),
  checklist_snapshot: checklistSchema,
  inspection_items: z.array(
    z.object({
      id: z.uuid(),
      item_key: z.string(),
      condition: z.string(),
      notes: z.string().nullable(),
    }),
  ),
  inspection_photos: z.array(
    z.object({
      id: z.uuid(),
      item_id: z.uuid().nullable(),
      status: z.string(),
    }),
  ),
});
export type InspectionView = z.infer<typeof inspectionViewSchema>;
const rentalSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  version: z.number(),
  customer_id: z.uuid(),
  vehicle_id: z.uuid(),
  branch_id: z.uuid(),
  quote_id: z.uuid(),
  reservation_id: z.uuid().nullable(),
  start_at: z.string(),
  end_at: z.string(),
  actual_start_at: z.string().nullable(),
  actual_end_at: z.string().nullable(),
  initial_mileage: z.coerce.number().nullable(),
  final_mileage: z.coerce.number().nullable(),
  initial_fuel: z.coerce.number().nullable(),
  final_fuel: z.coerce.number().nullable(),
  commercial_snapshot: json,
  rental_drivers: z.array(
    z.object({ driver_id: z.uuid(), driver_snapshot: json }),
  ),
  rental_locations: z.array(
    z.object({
      id: z.uuid(),
      direction: z.enum(["PICKUP", "RETURN"]),
      mode: z.string(),
      address_snapshot: json,
      fee: z.coerce.string(),
      instructions: z.string().nullable(),
      scheduled_at: z.string(),
      performed_at: z.string().nullable(),
      notes: z.string().nullable(),
    }),
  ),
  rental_extensions: z.array(
    z.object({
      id: z.uuid(),
      quote_id: z.uuid(),
      previous_end_at: z.string(),
      new_end_at: z.string(),
    }),
  ),
});
export type RentalView = z.infer<typeof rentalSchema>;
export async function getRental(id: string) {
  const { client, staff } = await requireStaff("rentals.read");
  z.uuid().parse(id);
  const result = await client
    .from("rentals")
    .select(
      "id,status,version,customer_id,vehicle_id,branch_id,quote_id,reservation_id,start_at,end_at,actual_start_at,actual_end_at,initial_mileage,final_mileage,initial_fuel,final_fuel,commercial_snapshot,rental_drivers(driver_id,driver_snapshot),rental_locations(id,direction,mode,address_snapshot,fee,instructions,scheduled_at,performed_at,notes),rental_extensions(id,quote_id,previous_end_at,new_end_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (result.error) databaseError(result.error);
  if (!result.data)
    throw new RegistryError(404, "NOT_FOUND", "Locação não encontrada.");
  const rental = rentalSchema.parse(result.data);
  const inspections = staff.permissions.includes("inspections.read")
    ? await client
        .from("inspections")
        .select(
          "id,kind,mileage,fuel,notes,completed_at,checklist_snapshot,inspection_items(id,item_key,condition,notes),inspection_photos(id,item_id,status)",
        )
        .eq("rental_id", id)
        .order("created_at", { ascending: false })
        .limit(30)
    : null;
  if (inspections?.error) databaseError(inspections.error);
  const contracts = staff.permissions.includes("contracts.read")
    ? await client
        .from("contracts")
        .select(
          "id,version,generation_status,attempts,last_error_code,sha256,created_at",
        )
        .eq("rental_id", id)
        .order("version", { ascending: false })
        .limit(30)
    : null;
  if (contracts?.error) databaseError(contracts.error);
  const events = await client
    .from("rental_events")
    .select("id,event_type,created_at,detail")
    .eq("rental_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (events.error) databaseError(events.error);
  const drivers = staff.permissions.includes("drivers.read")
    ? await client
        .from("drivers")
        .select("id,name,license_category,license_expires_on")
        .eq("customer_id", rental.customer_id)
        .is("archived_at", null)
        .order("name")
        .limit(100)
    : null;
  if (drivers?.error) databaseError(drivers.error);
  const conflicts = await client
    .from("vehicle_allocations")
    .select("id,reservation_id,rental_id,period")
    .eq("vehicle_id", rental.vehicle_id)
    .is("released_at", null)
    .neq("rental_id", id)
    .limit(20);
  // .neq exclui NULL no PostgREST: para reservas, consulta separada.
  const nextReservations = await client
    .from("vehicle_allocations")
    .select("reservation_id,period")
    .eq("vehicle_id", rental.vehicle_id)
    .eq("kind", "RESERVATION")
    .is("released_at", null)
    .limit(20);
  if (conflicts.error) databaseError(conflicts.error);
  if (nextReservations.error) databaseError(nextReservations.error);
  const damages = inspections?.data?.length
    ? await client
        .from("damages")
        .select("id,description,status,inspection_id")
        .in(
          "inspection_id",
          inspections.data.map((i) => i.id),
        )
        .order("created_at")
        .limit(200)
    : null;
  if (damages?.error) databaseError(damages.error);
  return {
    rental,
    inspections: z.array(inspectionViewSchema).parse(inspections?.data ?? []),
    contracts: z
      .array(
        z.object({
          id: z.uuid(),
          version: z.number(),
          generation_status: z.string(),
          attempts: z.number(),
          last_error_code: z.string().nullable(),
          sha256: z.string().nullable(),
          created_at: z.string(),
        }),
      )
      .parse(contracts?.data ?? []),
    events: z
      .array(
        z.object({
          id: z.uuid(),
          event_type: z.string(),
          created_at: z.string(),
          detail: json,
        }),
      )
      .parse(events.data),
    drivers: z
      .array(
        z.object({
          id: z.uuid(),
          name: z.string(),
          license_category: z.string(),
          license_expires_on: z.string(),
        }),
      )
      .parse(drivers?.data ?? []),
    nextReservations: nextReservations.data ?? [],
    conflicts: conflicts.data ?? [],
    damages: z
      .array(
        z.object({
          id: z.uuid(),
          description: z.string(),
          status: z.string(),
          inspection_id: z.uuid(),
        }),
      )
      .parse(damages?.data ?? []),
    overdue:
      ["ACTIVE", "OVERDUE"].includes(rental.status) &&
      Date.parse(rental.end_at) < Date.now(),
  };
}
export async function rentalSettings() {
  const { client } = await requireStaff("settings.manage");
  const policy = await client
    .from("system_settings")
    .select("value,updated_at")
    .eq("key", "rental_policy")
    .maybeSingle();
  const company = await client
    .from("company_settings")
    .select("legal_name,tax_document,contact,timezone,updated_at")
    .eq("singleton", true)
    .maybeSingle();
  if (company.error) databaseError(company.error);
  const templates = await client
    .from("contract_templates")
    .select("id,template_key,version,review_status")
    .order("created_at", { ascending: false })
    .limit(100);
  const inspections = await client
    .from("inspection_templates")
    .select("id,name,version")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(100);
  if (policy.error) databaseError(policy.error);
  if (templates.error) databaseError(templates.error);
  if (inspections.error) databaseError(inspections.error);
  return {
    policy: policy.data,
    company: z
      .object({
        legal_name: z.string(),
        tax_document: z.string(),
        contact: json,
        timezone: z.string(),
        updated_at: z.string(),
      })
      .nullable()
      .parse(company.data),
    templates: templates.data ?? [],
    inspections: inspections.data ?? [],
  };
}
export async function rentalFile(id: string, kind: "contract" | "photo") {
  const { client } = await requireStaff(
    kind === "contract" ? "contracts.read" : "inspections.read",
  );
  const result = await client
    .from(kind === "contract" ? "contracts" : "inspection_photos")
    .select(
      kind === "contract"
        ? "storage_path,generation_status"
        : "storage_path,status",
    )
    .eq("id", z.uuid().parse(id))
    .maybeSingle();
  if (result.error) databaseError(result.error);
  const row = z
    .object({
      storage_path: z.string().nullable(),
      generation_status: z.string().optional(),
      status: z.string().optional(),
    })
    .nullable()
    .parse(result.data);
  if (
    !row?.storage_path ||
    (kind === "contract"
      ? row.generation_status !== "GENERATED"
      : row.status !== "READY")
  )
    throw new AccessError(403);
  const link = await client.storage
    .from(kind === "contract" ? "contracts" : "inspections")
    .createSignedUrl(row.storage_path, 60, {
      download: `${kind}-${id}.${kind === "contract" ? "pdf" : "jpg"}`,
    });
  if (link.error || !link.data?.signedUrl)
    throw new RegistryError(
      503,
      "STORAGE_UNAVAILABLE",
      "Arquivo temporariamente indisponível.",
    );
  return link.data.signedUrl;
}
