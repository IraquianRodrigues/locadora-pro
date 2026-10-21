import { loadEnvFile } from "node:process";
import { URL } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
if (process.env.E2E_LOCAL_DISPOSABLE !== "yes")
  throw new Error(
    "Requer stack local descartável autorizada com E2E_LOCAL_DISPOSABLE=yes",
  );
loadEnvFile(".database-tests/local.env");
for (const value of [process.env.API_URL, process.env.DB_URL])
  if (
    !value ||
    !["127.0.0.1", "localhost", "[::1]"].includes(new URL(value).hostname)
  )
    throw new Error("Destino remoto recusado");
const appURL = "http://127.0.0.1:3200";
const env = {
  NEXT_PUBLIC_APP_URL: appURL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SERVICE_ROLE_KEY,
  APP_TIMEZONE: "America/Fortaleza",
  E2E_APP_URL: appURL,
  E2E_LOCAL_DISPOSABLE: "yes",
};
for (const key of [
  "AUTH_SECRET",
  "RENTAL_JOBS_SECRET",
  "OPERATIONS_JOBS_SECRET",
  "READINESS_SECRET",
])
  env[key] = randomBytes(32).toString("base64url");
const client = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const db = new pg.Client({ connectionString: process.env.DB_URL });
await db.connect();
try {
  for (const role of ["ADMIN", "ATTENDANT", "FINANCE"]) {
    const email = `phase9-${role.toLowerCase()}-${randomUUID()}@example.invalid`,
      password = randomBytes(32).toString("base64url");
    const created = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw new Error("Não foi possível preparar usuário fictício local");
    await db.query("begin");
    try {
      await db.query("update public.profiles set active=true where id=$1", [
        created.data.user.id,
      ]);
      await db.query(
        "insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code=$2",
        [created.data.user.id, role],
      );
      await db.query("commit");
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
    env[`E2E_${role}_EMAIL`] = email;
    env[`E2E_${role}_PASSWORD`] = password;
  }
  // wx recusa sobrescrever qualquer configuração local existente.
  await writeFile(
    ".env.local",
    Object.entries(env)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join("\n") + "\n",
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Três usuários fictícios e configuração HTTP preparados somente na stack local. Não publicar .env.local.",
  );
} finally {
  await db.end();
}
