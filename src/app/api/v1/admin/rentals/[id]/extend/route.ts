import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiFailure, readJson } from "@/lib/registry/api";
import { assertMutationOrigin } from "@/lib/registry/origin";
import { extendRental } from "@/lib/rentals/service";
import { operationEnvelope } from "@/lib/rentals/schema";
export const dynamic = "force-dynamic";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertMutationOrigin();
    const body = operationEnvelope.parse(await readJson(request)),
      input = z.object({ quote_id: z.uuid() }).strict().parse(body.input);
    return NextResponse.json(
      {
        data: await extendRental(
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
