import { readFile, mkdir, writeFile } from "node:fs/promises";
// Node 24 executa TypeScript sem build; caminho explícito para o utilitário de homologação.
// @ts-expect-error Import de .ts é intencional neste script executado pelo Node.
import { renderContractPdf } from "../src/lib/rentals/contract-pdf.ts";
const snapshot = JSON.parse(
  await readFile("tests/fixtures/contract.json", "utf8"),
);
await mkdir("output/pdf", { recursive: true });
await writeFile(
  "output/pdf/contrato-exemplo-ficticio.pdf",
  await renderContractPdf(snapshot, 1, "2026-10-20T12:00:00Z"),
);
console.log("PDF fictício gerado em output/pdf/contrato-exemplo-ficticio.pdf");
