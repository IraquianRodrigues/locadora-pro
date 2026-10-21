import { loadEnvFile } from "node:process";
import { URL } from "node:url";
import pg from "pg";
import { runDatabaseTests } from "../tests/integration/database.mjs";
if (process.env.E2E_LOCAL_DISPOSABLE !== "yes")
  throw new Error(
    "Requer E2E_LOCAL_DISPOSABLE=yes. Altera fixtures somente em stack local descartável.",
  );
loadEnvFile(".database-tests/local.env");
const url = new URL(process.env.DB_URL ?? "");
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  throw new Error("Banco remoto recusado");
const connect = async () => {
  const c = new pg.Client({ connectionString: url.href });
  await c.connect();
  return c;
};
const db = await connect();
try {
  const result = await runDatabaseTests(db, connect);
  console.log(
    `Supabase local: ${result.passed} cenários SQL aprovados; versão ${(await db.query("select version() as version")).rows[0].version.split(" on ")[0]}`,
  );
} finally {
  await db.end();
}
