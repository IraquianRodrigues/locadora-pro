import { NextResponse } from "next/server";
import { apiFailure } from "@/lib/registry/api";
import { assertMutationOrigin } from "@/lib/registry/origin";
import { expireReservations } from "@/lib/reservations/service";
export const dynamic = "force-dynamic";
export async function POST() {
  try {
    await assertMutationOrigin();
    return NextResponse.json(
      { data: { expired: await expireReservations() } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
