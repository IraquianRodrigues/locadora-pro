import { NextResponse, type NextRequest } from "next/server";
import { apiFailure, readJson } from "@/lib/registry/api";
import { assertMutationOrigin } from "@/lib/registry/origin";
import { getMaintenance, maintenanceCommand } from "@/lib/maintenance/service";
import { commandEnvelope } from "@/lib/finance/schema";
import { z } from "zod";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: NextRequest, { params }: Context) {
  try {
    return NextResponse.json(await getMaintenance((await params).id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return apiFailure(e);
  }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    await assertMutationOrigin();
    const id = z.uuid().parse((await params).id),
      body = commandEnvelope.parse(await readJson(request));
    const input = z
      .object({
        maintenance_id: z.literal(id),
        action: z.enum(["START", "RESCHEDULE", "EXTEND", "COMPLETE", "CANCEL"]),
      })
      .passthrough()
      .parse(body.input);
    return NextResponse.json(
      { data: await maintenanceCommand(input, body.idempotency_key) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiFailure(e);
  }
}
