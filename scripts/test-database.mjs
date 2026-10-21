import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// O empacotador beta possui exit hook que pode substituir exitCode. Supervisão
// independente exige um recibo de SUCESSO desta execução, além do exit status.
const runId = randomUUID();
const code = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["scripts/run-database-cluster.mjs"], {
    stdio: "inherit",
    env: { ...process.env, DB_TEST_RUN_ID: runId },
    windowsHide: true,
  });
  child.on("error", reject);
  child.on("exit", (code) => resolve(code));
});
const receipt = await readFile(".database-tests/latest-result.json", "utf8")
  .then(JSON.parse)
  .catch(() => null);
if (code !== 0 || receipt?.runId !== runId) {
  console.error(
    "Testes de banco falharam ou não produziram recibo de sucesso.",
  );
  process.exitCode = 1;
}
