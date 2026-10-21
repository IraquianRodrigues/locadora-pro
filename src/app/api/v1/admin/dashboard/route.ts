import { NextResponse, type NextRequest } from "next/server";
import { apiFailure } from "@/lib/registry/api";
import { businessDashboard } from "@/lib/reports/service";
import { reportDefaults } from "@/lib/reports/schema";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      await businessDashboard({
        ...reportDefaults(),
        ...Object.fromEntries(request.nextUrl.searchParams),
      }),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiFailure(e);
  }
}
