import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
export function authErrorResponse(status: 401 | 403 | 503) {
  const code =
    status === 401
      ? "UNAUTHORIZED"
      : status === 403
        ? "FORBIDDEN"
        : "AUTH_UNAVAILABLE";
  const message =
    status === 503
      ? "Autenticação temporariamente indisponível."
      : "Acesso não autorizado.";
  return NextResponse.json(
    { error: { code, message, requestId: randomUUID() } },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
