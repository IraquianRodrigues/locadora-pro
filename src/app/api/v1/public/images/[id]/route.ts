import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiFailure } from "@/lib/registry/api";
import { RegistryError } from "@/lib/registry/service";
import { publicAdminRPC, publicLimit } from "@/lib/public/service";
import { createAdminClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().parse((await params).id);
    await publicLimit("image", id, 300);
    const path = await publicAdminRPC("public_image_path", { file_id: id });
    if (typeof path !== "string")
      throw new RegistryError(404, "NOT_FOUND", "Imagem não encontrada.");
    const { data, error } = await createAdminClient()
      .storage.from("vehicle-images")
      .download(path);
    if (error || !data)
      throw new RegistryError(503, "IMAGE_UNAVAILABLE", "Imagem indisponível.");
    return new NextResponse(data, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiFailure(error);
  }
}
