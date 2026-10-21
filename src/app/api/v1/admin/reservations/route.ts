import { NextResponse, type NextRequest } from "next/server";
import { apiFailure, readJson } from "@/lib/registry/api";
import { assertMutationOrigin } from "@/lib/registry/origin";
import {
  listReservations,
  requestReservation,
} from "@/lib/reservations/service";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      await listReservations(Object.fromEntries(request.nextUrl.searchParams)),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    await assertMutationOrigin();
    const result = await requestReservation(await readJson(request));
    return NextResponse.json(
      { data: result },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
