import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authConfigured } from "@/lib/auth/config";
import { consumeLimit } from "@/lib/auth/limits";
import { createAdminClient } from "@/lib/supabase/admin";
import { tokenHash } from "@/lib/reservations/token";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const missing = () =>
    NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Reserva não encontrada ou consulta expirada.",
        },
      },
      { status: 404, headers },
    );
  try {
    if (!authConfigured())
      return NextResponse.json(
        {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Serviço temporariamente indisponível.",
          },
        },
        { status: 503, headers },
      );
    const raw = request.headers.get("X-Reservation-Token") ?? "";
    const hash = tokenHash(raw.slice(0, 200));
    if (!(await consumeLimit("reservation-status", hash, 30)))
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Aguarde antes de tentar novamente.",
          },
        },
        { status: 429, headers },
      );
    const id = z.uuid().safeParse((await params).id);
    if (!id.success || !/^[A-Za-z0-9_-]{43}$/.test(raw)) return missing();
    const { data, error } = await createAdminClient().rpc(
      "reservation_status_by_token",
      { reservation_id: id.data, token_hash: hash },
    );
    if (error) throw new Error("STATUS_UNAVAILABLE");
    if (!data) return missing();
    return NextResponse.json(
      {
        data: z
          .object({ id: z.uuid(), status: z.string(), updated_at: z.string() })
          .parse(data),
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Serviço temporariamente indisponível.",
        },
      },
      { status: 503, headers },
    );
  }
}
