import "server-only";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { registry } from "./config";
import {
  listSchema,
  recordId,
  revisionSchema,
  schemas,
  type Resource,
} from "./schema";

export class RegistryError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function databaseError(error: { code?: string } | null): never {
  if (error?.code === "23505")
    throw new RegistryError(
      409,
      "CONFLICT",
      "Já existe um cadastro com estes dados únicos. Confira nome, documento, placa, chassi, RENAVAM ou CNH.",
    );
  if (
    ["23503", "23514", "23P01", "40001", "40P01", "22023", "P0002"].includes(
      error?.code ?? "",
    )
  )
    throw new RegistryError(
      409,
      "BUSINESS_RULE_VIOLATION",
      "Não foi possível salvar: confira vínculos ativos, compromissos, quilometragem e dados do cadastro. Atualize a página antes de tentar novamente.",
    );
  if (error?.code === "42501")
    throw new RegistryError(
      403,
      "FORBIDDEN",
      "Sem permissão para esta operação.",
    );
  throw new RegistryError(
    503,
    "DATABASE_UNAVAILABLE",
    "Consulta temporariamente indisponível. Tente novamente.",
  );
}
export function escapeSearch(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
export async function listRecords(resource: Resource, input: unknown) {
  const definition = registry[resource];
  const filters = listSchema.parse(input);
  const { client } = await requireStaff(definition.read);
  let query = client
    .from(definition.table)
    .select(definition.columns, { count: "exact" });
  query =
    filters.archived === "true"
      ? query.not("archived_at", "is", null)
      : query.is("archived_at", null);
  if (filters.q)
    query = query.ilike(definition.search, `%${escapeSearch(filters.q)}%`);
  if (resource === "frota" && filters.category)
    query = query.eq("category_id", filters.category);
  if (resource === "frota" && filters.status)
    query = query.eq("operational_status", filters.status);
  const result = await query
    .order(definition.search)
    .order("id")
    .range((filters.page - 1) * 20, filters.page * 20 - 1);
  if (result.error) databaseError(result.error);
  return {
    data: result.data as unknown as Record<string, unknown>[],
    meta: { page: filters.page, pageSize: 20, total: result.count ?? 0 },
  };
}
export async function getRecord(resource: Resource, id: string) {
  recordId.parse(id);
  const { client } = await requireStaff(registry[resource].read);
  const result = await client
    .from(registry[resource].table)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (result.error) databaseError(result.error);
  if (!result.data)
    throw new RegistryError(404, "NOT_FOUND", "Cadastro não encontrado.");
  return result.data as Record<string, unknown>;
}
export async function saveRecord(
  resource: Resource,
  input: unknown,
  id?: string,
  revision?: string,
) {
  const { client } = await requireStaff(registry[resource].write);
  const values: Record<string, unknown> = schemas[resource].parse(input);
  const table = client.from(registry[resource].table);
  const query = id
    ? table
        .update(values)
        .eq("id", recordId.parse(id))
        .eq("updated_at", revisionSchema.parse(revision))
        .is("archived_at", null)
    : table.insert(values);
  const result = await query.select("id").maybeSingle();
  if (result.error) databaseError(result.error);
  if (!result.data)
    throw new RegistryError(
      409,
      "CONFLICT",
      "O cadastro foi alterado ou arquivado por outra pessoa. Atualize a página.",
    );
  return { id: z.uuid().parse(result.data.id) };
}
export async function archiveRecord(
  resource: Resource,
  id: string,
  revision: string,
  archive: boolean,
) {
  const { client } = await requireStaff(registry[resource].write);
  const table = client
    .from(registry[resource].table)
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", recordId.parse(id))
    .eq("updated_at", revisionSchema.parse(revision));
  const query = archive
    ? table.is("archived_at", null)
    : table.not("archived_at", "is", null);
  const result = await query.select("id").maybeSingle();
  if (result.error) databaseError(result.error);
  if (!result.data)
    throw new RegistryError(
      409,
      "CONFLICT",
      "O cadastro mudou. Atualize a página antes de continuar.",
    );
  return { id: z.uuid().parse(result.data.id) };
}
export async function lookupOptions(resource: Resource, search = "") {
  const { client } = await requireStaff(registry[resource].read);
  let query = client
    .from(registry[resource].table)
    .select(resource === "frota" ? "id,plate,make,model" : "id,name")
    .is("archived_at", null);
  if (["categorias", "unidades", "planos", "adicionais"].includes(resource))
    query = query.eq("active", true);
  if (resource === "frota") query = query.eq("operational_status", "ACTIVE");
  if (search)
    query = query.ilike(
      registry[resource].search,
      `%${escapeSearch(z.string().trim().max(100).parse(search))}%`,
    );
  const result = await query
    .order(registry[resource].search)
    .order("id")
    .limit(100);
  if (result.error) databaseError(result.error);
  return z.array(z.object({ id: z.uuid(), name: z.string() })).parse(
    resource === "frota"
      ? (
          result.data as unknown as {
            id: string;
            plate: string;
            make: string;
            model: string;
          }[]
        ).map((row) => ({
          id: row.id,
          name: `${row.plate} · ${row.make} ${row.model}`,
        }))
      : result.data,
  );
}
export async function vehicleHistory(id: string, page = 1) {
  recordId.parse(id);
  z.number().int().min(1).max(10000).parse(page);
  const { client, staff } = await requireStaff("vehicles.read");
  return Promise.all(
    (
      [
        {
          table: "rentals",
          permission: "rentals.read",
          title: "Histórico de locações",
          fields: "id,status,start_at,end_at",
        },
        {
          table: "maintenance_records",
          permission: "maintenance.read",
          title: "Histórico de manutenção",
          fields: "id,kind,status,start_at,end_at,mileage,description",
        },
      ] as const
    ).map(async (item) => {
      if (!staff.permissions.includes(item.permission))
        return { ...item, data: null, more: false };
      const result = await client
        .from(item.table)
        .select(item.fields)
        .eq("vehicle_id", id)
        .order("start_at", { ascending: false })
        .order("id")
        .range((page - 1) * 20, page * 20);
      if (result.error) databaseError(result.error);
      const rows = result.data as unknown as Record<string, unknown>[];
      return { ...item, data: rows.slice(0, 20), more: rows.length > 20 };
    }),
  );
}
