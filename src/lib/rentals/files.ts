import "server-only";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { consumeLimit } from "@/lib/auth/limits";
import { createAdminClient } from "@/lib/supabase/admin";
import { prepareFile } from "@/lib/registry/file-content";
import { databaseError, RegistryError } from "@/lib/registry/service";
export async function uploadInspectionPhoto(
  inspectionId: string,
  itemId: string,
  file: File,
) {
  const { client, staff } = await requireStaff("inspections.write");
  z.uuid().parse(inspectionId);
  z.uuid().parse(itemId);
  if (!(await consumeLimit("inspection-upload", staff.id, 30)))
    throw new RegistryError(
      429,
      "RATE_LIMITED",
      "Limite de fotos atingido. Aguarde alguns minutos.",
    );
  const content = await prepareFile(file, false);
  const prepare = await client.rpc("prepare_inspection_photo", {
    input: {
      inspection_id: inspectionId,
      item_id: itemId,
      sha256: content.sha256,
      byte_size: content.size,
    },
  });
  if (prepare.error) databaseError(prepare.error);
  const row = z
      .object({ id: z.uuid(), storage_path: z.string() })
      .parse(prepare.data),
    admin = createAdminClient();
  let uploaded = false;
  try {
    const upload = await admin.storage
      .from("inspections")
      .upload(row.storage_path, content.body, {
        contentType: "image/jpeg",
        cacheControl: "0",
        upsert: false,
      });
    if (upload.error) throw new Error("UPLOAD_FAILED");
    uploaded = true;
    const finish = await client.rpc("finish_inspection_photo", {
      photo_id: row.id,
      success: true,
    });
    if (finish.error) throw new Error("FINALIZE_FAILED");
  } catch {
    // Verificação evita apagar evidência READY após resposta de finalização perdida.
    const current = await admin
      .from("inspection_photos")
      .select("status")
      .eq("id", row.id)
      .maybeSingle();
    if (!current.error && current.data?.status === "READY")
      return { id: row.id };
    if (!current.error) {
      if (uploaded)
        await admin.storage.from("inspections").remove([row.storage_path]);
      await client.rpc("finish_inspection_photo", {
        photo_id: row.id,
        success: false,
      });
    }
    throw new RegistryError(
      503,
      "STORAGE_UNAVAILABLE",
      "A foto não foi confirmada. Atualize a vistoria antes de tentar novamente.",
    );
  }
  return { id: row.id };
}
