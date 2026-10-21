import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireStaff, verifiedStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeLimit } from "@/lib/auth/limits";
import { registry } from "./config";
import {
  fileAllowed,
  fileKindSchema,
  fileRowSchema,
  fileRules,
  type FileKind,
} from "./file-schema";
import { databaseError, RegistryError } from "./service";
import { recordId, type Resource } from "./schema";
import { prepareFile } from "./file-content";

export async function uploadRegistryFile(
  kind: FileKind,
  ownerId: string,
  label: string,
  file: File,
) {
  fileKindSchema.parse(kind);
  recordId.parse(ownerId);
  z.string().trim().min(1).max(120).parse(label);
  const rules = fileRules[kind];
  const { client, staff } = await requireStaff(registry[rules.resource].read);
  if (!fileAllowed(kind, staff.permissions, true))
    throw new RegistryError(
      403,
      "FORBIDDEN",
      "Sem permissão para anexar este arquivo.",
    );
  if (!(await consumeLimit("registry-upload", staff.id, 20)))
    throw new RegistryError(
      429,
      "RATE_LIMITED",
      "Limite de uploads atingido. Aguarde alguns minutos.",
    );
  const owner = await client
    .from(registry[rules.resource].table)
    .select("id")
    .eq("id", ownerId)
    .is("archived_at", null)
    .maybeSingle();
  if (owner.error) databaseError(owner.error);
  if (!owner.data)
    throw new RegistryError(
      404,
      "NOT_FOUND",
      "Cadastro indisponível para anexos.",
    );
  const content = await prepareFile(file, rules.bucket === "documents");
  const id = randomUUID(),
    path = `${ownerId}/${id}.${content.extension}`;
  // Uso privilegiado limitado ao arquivo gerado e validado nesta operação. Nunca recebe caminho do browser.
  const admin = createAdminClient();
  const prepared = await admin.from("registry_files").insert({
    id,
    kind,
    [rules.owner]: ownerId,
    bucket: rules.bucket,
    storage_path: path,
    label: label.trim(),
    media_type: content.mediaType,
    byte_size: content.size,
    sha256: content.sha256,
    uploaded_by: staff.id,
  });
  if (prepared.error) databaseError(prepared.error);
  try {
    const uploaded = await admin.storage
      .from(rules.bucket)
      .upload(path, content.body, {
        contentType: content.mediaType,
        cacheControl: "0",
        upsert: false,
      });
    if (uploaded.error) throw new Error("UPLOAD_FAILED");
    const current = await verifiedStaff(client);
    if (!fileAllowed(kind, current.permissions, true))
      throw new RegistryError(
        403,
        "FORBIDDEN",
        "A permissão de upload foi revogada.",
      );
    const finished = await admin
      .from("registry_files")
      .update({ status: "READY" })
      .eq("id", id)
      .eq("status", "PENDING")
      .select("id")
      .maybeSingle();
    if (finished.error || !finished.data) throw new Error("FINALIZE_FAILED");
  } catch (error) {
    const current = await admin
      .from("registry_files")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (!current.error && current.data?.status === "READY") return { id };
    // Commit de READY pode ter ocorrido com resposta perdida. Em resultado desconhecido,
    // preservar objeto/metadado para reconciliação, em vez de apagar um documento publicado.
    if (current.error)
      throw new RegistryError(
        503,
        "STORAGE_UNAVAILABLE",
        "Não foi possível confirmar o arquivo. Atualize o cadastro antes de tentar novamente.",
      );
    // Compensação limitada ao UUID desta operação. Falha mantém registro FAILED/PENDING para reconciliação.
    try {
      await admin.storage.from(rules.bucket).remove([path]);
    } catch {
      /* Reconciliação administrativa documentada. */
    }
    try {
      await admin
        .from("registry_files")
        .update({ status: "FAILED" })
        .eq("id", id)
        .eq("status", "PENDING");
    } catch {
      /* Não anunciar sucesso. */
    }
    if (error instanceof RegistryError) throw error;
    throw new RegistryError(
      503,
      "STORAGE_UNAVAILABLE",
      "O upload não foi concluído. Tente novamente; arquivos pendentes não ficam disponíveis.",
    );
  }
  return { id };
}
export async function listRegistryFiles(
  resource: Resource,
  ownerId: string,
  page = 1,
) {
  recordId.parse(ownerId);
  z.number().int().min(1).max(10000).parse(page);
  const { client } = await requireStaff(registry[resource].read);
  const rule = Object.values(fileRules).find(
    (rule) => rule.resource === resource,
  );
  if (!rule) return { data: [], more: false };
  const result = await client
    .from("registry_files")
    .select(
      "id,kind,label,status,media_type,byte_size,created_at,bucket,storage_path,public_visible",
    )
    .eq(rule.owner, ownerId)
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 20, page * 20);
  if (result.error) databaseError(result.error);
  const data = z.array(fileRowSchema).parse(result.data);
  return { data: data.slice(0, 20), more: data.length > 20 };
}
async function authorizedFile(id: string, writing = false) {
  recordId.parse(id);
  const { client, staff } = await requireStaff();
  const result = await client
    .from("registry_files")
    .select(
      "id,kind,label,status,media_type,byte_size,created_at,bucket,storage_path",
    )
    .eq("id", id)
    .maybeSingle();
  if (result.error) databaseError(result.error);
  if (!result.data)
    throw new RegistryError(404, "NOT_FOUND", "Arquivo não encontrado.");
  const file = fileRowSchema.parse(result.data);
  if (
    file.status !== "READY" ||
    !fileAllowed(file.kind, staff.permissions, writing)
  )
    throw new RegistryError(
      403,
      "FORBIDDEN",
      "Arquivo não autorizado ou indisponível.",
    );
  return { client, file };
}
export async function signRegistryFile(id: string) {
  const { client, file } = await authorizedFile(id);
  const result = await client.storage
    .from(file.bucket)
    .createSignedUrl(file.storage_path, 60, {
      download: `arquivo-${file.id}.${file.media_type === "application/pdf" ? "pdf" : "jpg"}`,
    });
  if (result.error || !result.data?.signedUrl)
    throw new RegistryError(
      503,
      "STORAGE_UNAVAILABLE",
      "Não foi possível gerar o link temporário.",
    );
  return result.data.signedUrl;
}
export async function archiveRegistryFile(id: string) {
  const { client } = await authorizedFile(id, true);
  const result = await client.rpc("archive_registry_file", { file_id: id });
  if (result.error) databaseError(result.error);
}
