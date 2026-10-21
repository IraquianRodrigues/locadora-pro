import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { authConfig } from "./config";
import { limitHash } from "./security";

export async function consumeLimit(
  scope: string,
  identity: string,
  maximum = 5,
) {
  const { secret } = authConfig();
  const client = createAdminClient();
  // Não depende de headers de IP, cuja procedência varia entre proxies de hospedagem.
  for (const [key, max] of [
    ["global", 1000],
    [identity, maximum],
  ] as const) {
    const { data, error } = await client.rpc("consume_auth_limit", {
      key_hash: limitHash(secret, scope, key),
      max_attempts: max,
      window_seconds: 900,
    });
    if (error) throw new Error("AUTH_LIMIT_UNAVAILABLE");
    if (data !== true) return false;
  }
  return true;
}
