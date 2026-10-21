import { NextResponse, type NextRequest } from "next/server";
import { apiFailure } from "@/lib/registry/api";
import { getQuote } from "@/lib/reservations/service";
export const dynamic = "force-dynamic";
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return NextResponse.json(
      { data: await getQuote((await params).id) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
