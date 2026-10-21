import { NextResponse, type NextRequest } from "next/server";
import { apiFailure, readJson } from "@/lib/registry/api";
import { assertMutationOrigin } from "@/lib/registry/origin";
import { getReservation, decideReservation } from "@/lib/reservations/service";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: NextRequest, { params }: Context) {
  try {
    return NextResponse.json(
      { data: await getReservation((await params).id) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    await assertMutationOrigin();
    return NextResponse.json(
      {
        data: await decideReservation(
          (await params).id,
          await readJson(request),
        ),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
