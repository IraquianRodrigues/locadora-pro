import { NextResponse } from "next/server";
import { AccessError, requireStaff } from "@/lib/auth/session";
import { authErrorResponse } from "@/lib/auth/api-error";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { staff } = await requireStaff();
    return NextResponse.json(
      {
        data: {
          id: staff.id,
          displayName: staff.displayName,
          roles: staff.roles,
          permissions: staff.permissions,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 503;
    return authErrorResponse(status);
  }
}
