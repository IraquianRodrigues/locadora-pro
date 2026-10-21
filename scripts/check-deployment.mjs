import nextEnvironment from "@next/env";
import { registerSourceLoader } from "./lib/source-loader.mjs";
nextEnvironment.loadEnvConfig(process.cwd(), false, {
  info: () => {},
  error: () => {},
});
registerSourceLoader();
const { deploymentChecks } = await import("../src/config/deployment.ts");
const failures = deploymentChecks(process.env);
if (failures.length) {
  console.error("Deploy não liberado pela configuração:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else
  console.log(
    "Configuração sintática aprovada. Homologação, backups e aceite operacional ainda são necessários.",
  );
