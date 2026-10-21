import { NextResponse, type NextRequest } from "next/server";
import { apiFailure, readJson } from "@/lib/registry/api";
import { assertMutationOrigin } from "@/lib/registry/origin";
import { availability } from "@/lib/reservations/service";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    await assertMutationOrigin();
    return NextResponse.json(
      { data: await availability(await readJson(request)) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
