import { NextResponse, type NextRequest } from "next/server";
import { apiFailure } from "@/lib/registry/api";
import { exportReport } from "@/lib/reports/service";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const r = await exportReport(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    return new NextResponse(r.body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${r.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    return apiFailure(e);
  }
}
