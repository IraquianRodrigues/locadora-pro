import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiFailure, readJson } from "@/lib/registry/api";
import { assertMutationOrigin } from "@/lib/registry/origin";
import { getRental, commandRental } from "@/lib/rentals/service";
import { operationEnvelope } from "@/lib/rentals/schema";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: NextRequest, { params }: Context) {
  try {
    return NextResponse.json(
      { data: await getRental((await params).id) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiFailure(e);
  }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    await assertMutationOrigin();
    const body = operationEnvelope.parse(await readJson(request)),
      input = z.record(z.string(), z.unknown()).parse(body.input);
    return NextResponse.json(
      {
        data: await commandRental(
          { ...input, rental_id: (await params).id },
          body.idempotency_key,
        ),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiFailure(e);
  }
}
