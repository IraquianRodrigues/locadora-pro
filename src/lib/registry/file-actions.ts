"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertMutationOrigin } from "./origin";
import {
  archiveRegistryFile,
  signRegistryFile,
  uploadRegistryFile,
} from "./files";
import { fileKindSchema, fileRules } from "./file-schema";
import { RegistryError } from "./service";
function fileError(error: unknown) {
  return {
    ok: false as const,
    message:
      error instanceof RegistryError
        ? error.message
        : "Não foi possível concluir a operação do arquivo. Confira sua sessão e tente novamente.",
  };
}
export async function uploadRegistryFileAction(form: FormData) {
  try {
    await assertMutationOrigin();
    const kind = fileKindSchema.parse(form.get("kind"));
    const ownerId = z.uuid().parse(form.get("owner_id")),
      label = z.string().trim().min(1).max(120).parse(form.get("label"));
    const file = form.get("file");
    if (!(file instanceof File))
      throw new RegistryError(400, "INVALID_FILE", "Escolha um arquivo.");
    await uploadRegistryFile(kind, ownerId, label, file);
    revalidatePath(`/admin/${fileRules[kind].resource}/${ownerId}`);
    return { ok: true as const, message: "Arquivo anexado." };
  } catch (error) {
    return fileError(error);
  }
}
export async function signRegistryFileAction(id: string) {
  try {
    await assertMutationOrigin();
    return { ok: true as const, url: await signRegistryFile(id) };
  } catch (error) {
    return fileError(error);
  }
}
export async function archiveRegistryFileAction(id: string) {
  try {
    await assertMutationOrigin();
    await archiveRegistryFile(id);
    revalidatePath("/admin", "layout");
    return { ok: true as const, message: "Arquivo arquivado." };
  } catch (error) {
    return fileError(error);
  }
}
