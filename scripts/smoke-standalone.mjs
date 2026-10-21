import { access, cp, mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { setTimeout } from "node:timers";
import { URL } from "node:url";
import { Worker } from "node:worker_threads";
import { PDFDocument } from "pdf-lib";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
const app = resolve(".next/standalone");
await access(resolve(app, "server.js"));
await access(resolve(app, "assets/fonts/NotoSans-Regular.ttf"));
await access(resolve(app, "assets/fonts/OFL.txt"));
await cp(resolve("public"), resolve(app, "public"), { recursive: true });
const pdf = await PDFDocument.create();
pdf.addPage();
const pdfBytes = await pdf.save();
await new Promise((resolveWorker, reject) => {
  const worker = new Worker(resolve(app, "assets/workers/pdf-validator.mjs"), {
    workerData: pdfBytes,
    resourceLimits: { maxOldGenerationSizeMb: 128 },
  });
  worker.once("message", (valid) => {
    void worker.terminate();
    if (valid === true) resolveWorker();
    else reject(new Error("Worker standalone recusou PDF simples"));
  });
  worker.once("error", reject);
});
await cp(resolve(".next/static"), resolve(app, ".next/static"), {
  recursive: true,
});
const listener = createServer();
await new Promise((done) => listener.listen(0, "127.0.0.1", done));
const port = listener.address().port;
await new Promise((done) => listener.close(done));
const child = spawn(process.execPath, ["server.js"], {
  cwd: app,
  windowsHide: true,
  env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(port) },
  stdio: ["ignore", "ignore", "ignore"],
});
const url = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url + "/api/v1/health");
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {
      /* aguarda inicialização */
    }
    await new Promise((done) => setTimeout(done, 200));
  }
  if (!ready) throw new Error("Servidor standalone não iniciou");
  const response = await fetch(url + "/");
  if (!response.ok) throw new Error("Home indisponível");
  const html = await response.text();
  const paths = [
    ...new Set(
      [
        ...html.matchAll(
          /(?:src|href)="([^"?]*\/_next\/static\/[^"?]+)(?:\?[^"]*)?"/g,
        ),
      ].map((m) => m[1]),
    ),
  ];
  if (!paths.length) throw new Error("HTML sem assets estáticos");
  const brandAsset = await fetch(url + "/brand/apex-metallic.png");
  if (
    !brandAsset.ok ||
    !(brandAsset.headers.get("content-type") ?? "").includes("image/")
  )
    throw new Error("Imagem da marca ausente no standalone");
  let bytes = 0;
  for (const path of paths) {
    const r = await fetch(new URL(path, url));
    if (!r.ok) throw new Error("Asset ausente no standalone");
    bytes += (await r.arrayBuffer()).byteLength;
  }
  const samples = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    const r = await fetch(url + "/api/v1/health");
    await r.arrayBuffer();
    if (!r.ok) throw new Error("Liveness indisponível");
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const result = {
    node: process.version,
    health_samples: 10,
    health_p50_ms: Number(samples[5].toFixed(2)),
    health_max_ms: Number(samples[9].toFixed(2)),
    initial_assets: paths.length,
    initial_assets_uncompressed_bytes: bytes,
    font_included: true,
    pdf_worker_verified: true,
    note: "Medição local aquecida, sem carga e sem Supabase; não é SLO de produção.",
  };
  await mkdir(resolve("output"), { recursive: true });
  await writeFile(
    resolve("output/standalone-smoke.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  child.kill();
}
