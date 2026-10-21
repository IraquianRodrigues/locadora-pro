"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { AccessError } from "@/lib/auth/session";
import {
  archiveRecord,
  RegistryError,
  saveRecord,
  lookupOptions,
} from "./service";
import { resourceSchema, type MutationResult } from "./schema";
import { assertMutationOrigin } from "./origin";

function failure(error: unknown): MutationResult {
  if (error instanceof z.ZodError)
    return {
      ok: false,
      message: "Confira os campos indicados.",
      fields: Object.fromEntries(
        error.issues.map((issue) => [String(issue.path[0]), issue.message]),
      ),
    };
  if (error instanceof RegistryError)
    return { ok: false, message: error.message };
  if (error instanceof AccessError)
    return {
      ok: false,
      message: "Sem acesso ou sessão indisponível. Entre novamente.",
    };
  return { ok: false, message: "Não foi possível concluir. Tente novamente." };
}
export async function saveRegistryAction(
  resource: unknown,
  input: unknown,
  id?: string,
  revision?: string,
): Promise<MutationResult> {
  try {
    await assertMutationOrigin();
    const kind = resourceSchema.parse(resource);
    const result = await saveRecord(kind, input, id, revision);
    revalidatePath(`/admin/${kind}`);
    return { ok: true, ...result };
  } catch (error) {
    return failure(error);
  }
}
export async function archiveRegistryAction(
  resource: unknown,
  id: string,
  revision: string,
  archive: boolean,
): Promise<MutationResult> {
  try {
    await assertMutationOrigin();
    const kind = resourceSchema.parse(resource);
    z.boolean().parse(archive);
    const result = await archiveRecord(kind, id, revision, archive);
    revalidatePath(`/admin/${kind}`);
    return { ok: true, ...result };
  } catch (error) {
    return failure(error);
  }
}
export async function searchRegistryOptionsAction(
  resource: unknown,
  search: unknown,
) {
  try {
    await assertMutationOrigin();
    const kind = z
      .enum([
        "categorias",
        "unidades",
        "clientes",
        "frota",
        "planos",
        "adicionais",
      ])
      .parse(resource);
    return {
      ok: true as const,
      data: await lookupOptions(kind, z.string().trim().max(100).parse(search)),
    };
  } catch {
    return {
      ok: false as const,
      message: "Não foi possível buscar os vínculos.",
    };
  }
}
