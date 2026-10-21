import SwaggerParser from "@apidevtools/swagger-parser";
import { readFile } from "node:fs/promises";
for (const file of [
  "docs/api/openapi.yaml",
  "docs/api/internal.openapi.yaml",
]) {
  const api = await SwaggerParser.validate(file);
  const inventory = JSON.parse(
    await readFile("docs/security/endpoints.json", "utf8"),
  );
  const prefix = file.includes("internal.") ? "/api/internal" : "/api/v1";
  for (const route of inventory.routes.filter((r) =>
    r.path.startsWith(prefix + "/"),
  )) {
    const path = route.path.slice(prefix.length),
      documented = api.paths?.[path];
    for (const method of route.methods)
      if (!documented?.[method.toLowerCase()])
        throw new Error(`Operação sem contrato: ${method} ${route.path}`);
  }
  console.log(
    `${file}: schema OpenAPI/referências e cobertura de rotas aprovados.`,
  );
}
