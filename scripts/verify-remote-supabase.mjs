import nextEnvironment from "@next/env";
import { writeFileSync } from "node:fs";

// Somente leituras. Não cria usuários, dados de negócio, arquivos ou sessões.
nextEnvironment.loadEnvConfig(process.cwd(), false, undefined, true);
const expectedRef = "zfvqvzhajnjwpsbajqux";
const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (origin !== `https://${expectedRef}.supabase.co` || !key)
  throw new Error("Projeto remoto esperado não configurado.");
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const checks = [];
async function check(name, path, accept) {
  const response = await fetch(`${origin}${path}`, {
    headers,
    signal: globalThis.AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => null);
  checks.push({
    name,
    status: response.status,
    passed: accept(response, body),
  });
}
await check("auth_settings", "/auth/v1/settings", (r, b) => {
  if (!r.ok || !b) return false;
  checks.push({
    name: "public_signup_disabled",
    passed: b.disable_signup === true,
  });
  checks.push({
    name: "anonymous_signins_disabled",
    passed: b.external?.anonymous_users === false,
  });
  return true;
});
for (const table of ["profiles", "customers", "vehicles", "payments"])
  await check(
    `anon_${table}_denied`,
    `/rest/v1/${table}?select=id&limit=1`,
    (r, b) =>
      [401, 403].includes(r.status) ||
      (r.ok && Array.isArray(b) && b.length === 0),
  );
await check(
  "anon_readiness_denied",
  "/rest/v1/rpc/operational_readiness",
  (r) => [401, 403].includes(r.status),
);
await check(
  "anon_buckets_hidden",
  "/storage/v1/bucket",
  (r, b) =>
    [401, 403].includes(r.status) ||
    (r.ok && Array.isArray(b) && b.length === 0),
);
const result = {
  project_ref: expectedRef,
  checked_at: new Date().toISOString(),
  read_only: true,
  checks,
  passed: checks.every((c) => c.passed),
};
writeFileSync(
  "output/supabase-remote-verification.json",
  JSON.stringify(result, null, 2) + "\n",
);
for (const c of checks) console.log(`${c.passed ? "PASS" : "FAIL"} ${c.name}`);
if (!result.passed) process.exitCode = 1;
