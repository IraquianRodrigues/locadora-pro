import { NextResponse, type NextRequest } from "next/server";
import { apiFailure } from "@/lib/registry/api";
import { RegistryError } from "@/lib/registry/service";
import { getCatalog } from "@/lib/public/catalog";
export const dynamic = "force-dynamic";
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const result = await getCatalog({}, (await params).id);
    if (!result.data[0])
      throw new RegistryError(404, "NOT_FOUND", "Veículo não encontrado.");
    return NextResponse.json(
      { data: result.data[0] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
