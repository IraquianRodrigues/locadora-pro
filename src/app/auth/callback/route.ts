import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authConfig } from "@/lib/auth/config";
import { verifiedStaff } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/security";
import { consumeLimit } from "@/lib/auth/limits";

export async function GET(request: NextRequest) {
  let destination = "/login?link=invalido";
  try {
    authConfig();
    const code = request.nextUrl.searchParams.get("code");
    if (!code || code.length > 2048 || !(await consumeLimit("pkce", code, 5)))
      throw new Error("INVALID_CODE");
    const client = await createClient(true);
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw new Error("INVALID_CODE");
    try {
      await verifiedStaff(client);
      destination = safeNext(request.nextUrl.searchParams.get("next"));
    } catch {
      await client.auth.signOut({ scope: "local" });
    }
    // Callback PKCE não emite autorização de alteração de senha.
  } catch {
    /* Erros não carregam código/token para a próxima URL. */
  }
  return NextResponse.redirect(new URL(destination, request.url), {
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
