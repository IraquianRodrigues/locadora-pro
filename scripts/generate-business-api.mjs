// Node 24: usa os mesmos schemas Zod do servidor, sem instalar runtime TypeScript.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { URL, fileURLToPath, pathToFileURL } from "node:url";
import { resolve, extname } from "node:path";
import { z } from "zod";
import { format } from "prettier";
const root = fileURLToPath(new URL("../", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/"))
      return nextResolve(
        pathToFileURL(resolve(root, "src", specifier.slice(2)) + ".ts").href,
        context,
      );
    if (
      specifier.startsWith(".") &&
      !extname(specifier) &&
      context.parentURL?.endsWith(".ts")
    ) {
      const url = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { financeCommandSchema, commandEnvelope } =
  await import("../src/lib/finance/schema.ts");
const { maintenanceCommandSchema } =
  await import("../src/lib/maintenance/schema.ts");
const { reportFilterSchema } = await import("../src/lib/reports/schema.ts");
const definitions = {
  FinanceCommand: financeCommandSchema,
  MaintenanceCommand: maintenanceCommandSchema,
  ReportFilter: reportFilterSchema,
  CommandEnvelope: commandEnvelope,
};
const rentals = await import("../src/lib/rentals/schema.ts");
Object.assign(definitions, {
  CreateRental: rentals.createRentalSchema,
  RentalCommand: rentals.commandSchema,
  RentalExtension: rentals.extensionSchema,
});
const document = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  description:
    "Gerado dos schemas Zod. Refinamentos, transformações e validações transacionais adicionais estão documentados em business.md.",
  $defs: Object.fromEntries(
    Object.entries(definitions).map(([name, schema]) => {
      const json = z.toJSONSchema(schema, {
        io: "input",
        unrepresentable: "any",
      });
      delete json.$schema;
      return [name, json];
    }),
  ),
};
await writeFile(
  resolve(root, "docs/api/business.schemas.json"),
  await format(JSON.stringify(document), { parser: "json" }),
);
console.log(
  "Schemas de negócio atualizados a partir dos validadores do servidor.",
);
