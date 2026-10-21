import { NextResponse, type NextRequest } from "next/server";
import { apiFailure, readJson } from "@/lib/registry/api";
import { assertMutationOrigin } from "@/lib/registry/origin";
import { listRentals, createRental } from "@/lib/rentals/service";
import { operationEnvelope } from "@/lib/rentals/schema";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      await listRentals(Object.fromEntries(request.nextUrl.searchParams)),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiFailure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    await assertMutationOrigin();
    const { input, idempotency_key } = operationEnvelope.parse(
      await readJson(request),
    );
    return NextResponse.json(
      { data: await createRental(input, idempotency_key) },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiFailure(e);
  }
}
