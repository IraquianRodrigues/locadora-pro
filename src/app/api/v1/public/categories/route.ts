import { NextResponse } from "next/server";
import { apiFailure } from "@/lib/registry/api";
import { bookingOptions } from "@/lib/public/catalog";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(
      { data: (await bookingOptions()).categories },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
