import { NextResponse, type NextRequest } from "next/server";
import { apiFailure, apiResource, readJson } from "@/lib/registry/api";
import { listRecords, saveRecord } from "@/lib/registry/service";
import { assertMutationOrigin } from "@/lib/registry/origin";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    const { resource } = await context.params;
    return NextResponse.json(
      await listRecords(
        apiResource(resource),
        Object.fromEntries(request.nextUrl.searchParams),
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    await assertMutationOrigin();
    const { resource } = await context.params;
    const result = await saveRecord(
      apiResource(resource),
      await readJson(request),
    );
    return NextResponse.json(
      { data: result },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
          Location: `/api/v1/admin/${resource}/${result.id}`,
        },
      },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
