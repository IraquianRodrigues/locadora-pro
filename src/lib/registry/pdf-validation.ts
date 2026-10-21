import "server-only";
import { Worker } from "node:worker_threads";
import { join } from "node:path";
// O parser não disputa o event loop da requisição; CPU/heap são limitados por execução.
export async function validatePassivePdf(bytes: Uint8Array) {
  await new Promise<void>((resolve, reject) => {
    const worker = new Worker(
      join(process.cwd(), "assets/workers/pdf-validator.mjs"),
      {
        workerData: bytes,
        resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
      },
    );
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (ok) resolve();
      else reject(new Error("INVALID_PDF"));
    };
    const timer = setTimeout(() => finish(false), 5000);
    worker.once("message", (ok) => finish(ok === true));
    worker.once("error", () => finish(false));
    worker.once("exit", () => finish(false));
  });
}
