"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { assertMutationOrigin } from "@/lib/registry/origin";
import { databaseError } from "@/lib/registry/service";
import { siteSchema } from "./schema";
export async function savePublicSite(raw: unknown, version: number) {
  try {
    await assertMutationOrigin();
    const { client } = await requireStaff("settings.manage");
    const input = siteSchema.parse({
      ...z.record(z.string(), z.unknown()).parse(raw),
      terms_version: randomUUID(),
    });
    z.number().int().min(0).parse(version);
    const { error } = await client.rpc("set_public_site", {
      input,
      expected_version: version,
    });
    if (error) databaseError(error);
    revalidatePath("/", "layout");
    revalidatePath("/admin/site");
    return {
      ok: true as const,
      message: "Configuração salva. Termos receberam uma nova versão.",
    };
  } catch {
    return {
      ok: false as const,
      message:
        "Confira os campos, suas permissões e a versão da página antes de tentar novamente.",
    };
  }
}
export async function publishImage(id: string, published: boolean) {
  try {
    await assertMutationOrigin();
    const { client } = await requireStaff();
    z.uuid().parse(id);
    z.boolean().parse(published);
    const { error } = await client.rpc("publish_catalog_image", {
      file_id: id,
      published,
    });
    if (error) databaseError(error);
    revalidatePath("/admin/frota", "layout");
    return {
      ok: true as const,
      message: published
        ? "Imagem publicada no catálogo."
        : "Imagem retirada do catálogo.",
    };
  } catch {
    return {
      ok: false as const,
      message: "Não foi possível alterar a publicação da imagem.",
    };
  }
}
