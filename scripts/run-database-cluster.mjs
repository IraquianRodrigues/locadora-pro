import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { runDatabaseTests } from "../tests/integration/database.mjs";

// Nunca utiliza DATABASE_URL nem conecta a um servidor externo.
// Cada execução cria seu próprio cluster, sem reset/delete de bancos existentes.
const root = path.resolve(".database-tests");
const runId = process.env.DB_TEST_RUN_ID;
if (!runId)
  throw new Error("Use npm run test:db, não execute o worker diretamente.");
await mkdir(root, { recursive: true });
const directory = path.join(root, `run-${randomUUID()}`);
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close(() => resolve(address.port));
  });
});
const password = randomBytes(24).toString("hex");
const cluster = new EmbeddedPostgres({
  databaseDir: directory,
  port,
  user: "postgres",
  password,
  authMethod: "scram-sha-256",
  persistent: true,
  createPostgresUser: false,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
let started = false;
let db;
try {
  console.log("Inicializando PostgreSQL isolado de testes...");
  await cluster.initialise();
  await cluster.start();
  started = true;
  const options = {
    host: "127.0.0.1",
    port,
    user: "postgres",
    password,
    database: "postgres",
    connectionTimeoutMillis: 10000,
    options: "-c statement_timeout=15000 -c lock_timeout=10000",
  };
  db = new pg.Client(options);
  await db.connect();
  await db.query(
    await readFile("tests/integration/support/supabase-platform.sql", "utf8"),
  );
  const migrations = (await readdir("supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of migrations) {
    try {
      await db.query("begin");
      await db.query(
        await readFile(path.join("supabase/migrations", name), "utf8"),
      );
      await db.query("commit");
      console.log(`MIGRATION OK ${name}`);
    } catch (error) {
      await db.query("rollback");
      throw new Error(
        `Migration ${name}: ${error.code} ${error.message}; position=${error.position ?? error.internalPosition}; ${error.where ?? ""}`,
        { cause: error },
      );
    }
  }
  const connect = async () => {
    const client = new pg.Client(options);
    await client.connect();
    return client;
  };
  const result = await runDatabaseTests(db, connect);
  const version = (await db.query("select version()")).rows[0].version;
  await writeFile(
    path.join(root, "latest-result.json"),
    JSON.stringify(
      { runId, version, migrations: migrations.length, ...result },
      null,
      2,
    ),
  );
  console.log(
    `${result.passed} testes de banco aprovados em ${version.split(" on ")[0]}.`,
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (db) await db.end();
  if (started) await cluster.stop();
}
