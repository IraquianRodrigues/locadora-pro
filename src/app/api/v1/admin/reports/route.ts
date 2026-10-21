import { NextResponse, type NextRequest } from "next/server";
import { apiFailure } from "@/lib/registry/api";
import { businessReport } from "@/lib/reports/service";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      await businessReport(Object.fromEntries(request.nextUrl.searchParams)),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiFailure(e);
  }
}
