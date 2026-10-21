import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processBusinessJobs } from "@/lib/notifications/worker";
export const runtime = "nodejs",
  dynamic = "force-dynamic",
  maxDuration = 60;
export async function POST(request: NextRequest) {
  const secret = process.env.OPERATIONS_JOBS_SECRET,
    auth = request.headers.get("authorization") ?? "",
    expected = `Bearer ${secret ?? ""}`,
    headers = {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    };
  if (!secret || secret.length < 32)
    return NextResponse.json(
      { error: "Serviço não configurado." },
      { status: 503, headers },
    );
  if (
    Buffer.byteLength(auth) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  )
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401, headers },
    );
  try {
    return NextResponse.json(await processBusinessJobs(), { headers });
  } catch {
    return NextResponse.json(
      { error: "Processamento temporariamente indisponível." },
      { status: 503, headers },
    );
  }
}
