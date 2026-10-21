import { NextResponse, type NextRequest } from "next/server";
import { apiFailure, readJson } from "@/lib/registry/api";
import { assertMutationOrigin } from "@/lib/registry/origin";
import { listMaintenance, maintenanceCommand } from "@/lib/maintenance/service";
import { commandEnvelope } from "@/lib/finance/schema";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      await listMaintenance(Object.fromEntries(request.nextUrl.searchParams)),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiFailure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    await assertMutationOrigin();
    const body = commandEnvelope.parse(await readJson(request));
    return NextResponse.json(
      { data: await maintenanceCommand(body.input, body.idempotency_key) },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiFailure(e);
  }
}
