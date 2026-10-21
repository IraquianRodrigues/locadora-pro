import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deploymentChecks } from "@/config/deployment";
import { internalAuthorization } from "@/lib/operations/secret";
import { requireSupabaseEnvironment } from "@/config/env";
import { z } from "zod";
export const runtime = "nodejs",
  dynamic = "force-dynamic",
  maxDuration = 15;
export async function GET(request: NextRequest) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };
  const authorized = internalAuthorization(
    process.env.READINESS_SECRET,
    request.headers.get("authorization"),
  );
  if (authorized !== 200)
    return NextResponse.json(
      { status: "unavailable" },
      { status: authorized, headers },
    );
  const checks = {
    configuration: deploymentChecks(process.env).length === 0,
    auth: false,
    database: false,
    schema: false,
    storage: false,
    rls: false,
  };
  try {
    const { url, key } = requireSupabaseEnvironment();
    const [database, auth] = await Promise.all([
      createAdminClient()
        .rpc("operational_readiness")
        .abortSignal(AbortSignal.timeout(5000)),
      fetch(`${url}/auth/v1/health`, {
        headers: { apikey: key },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      }),
    ]);
    checks.auth = auth.ok;
    if (!database.error) {
      const parsed = z
        .object({ schema: z.boolean(), storage: z.boolean(), rls: z.boolean() })
        .parse(database.data);
      checks.database = true;
      Object.assign(checks, parsed);
    }
  } catch {
    /* Somente booleans; nunca detalhes do banco ou configuração. */
  }
  const ready = Object.values(checks).every(Boolean);
  return NextResponse.json(
    { status: ready ? "ready" : "not_ready", checks },
    { status: ready ? 200 : 503, headers },
  );
}
