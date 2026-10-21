import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiFailure, readJson } from "@/lib/registry/api";
import { assertMutationOrigin } from "@/lib/registry/origin";
import { createQuote } from "@/lib/reservations/service";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    await assertMutationOrigin();
    const body = z
      .object({ input: z.unknown(), idempotency_key: z.string() })
      .strict()
      .parse(await readJson(request));
    return NextResponse.json(
      { data: await createQuote(body.input, body.idempotency_key) },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
