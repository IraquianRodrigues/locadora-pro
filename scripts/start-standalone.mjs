import { cp, access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import nextEnvironment from "@next/env";
const root = process.cwd();
nextEnvironment.loadEnvConfig(root, false, { info: () => {}, error: () => {} });
const args = process.argv.slice(2),
  options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!["--hostname", "--port"].includes(args[i]) || !args[i + 1])
    throw new Error("Use --hostname e --port com valores explícitos");
  options[args[i]] = args[i + 1];
}
const port = options["--port"] ?? process.env.PORT ?? "3000";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
  throw new Error("Porta inválida");
process.env.PORT = port;
process.env.HOSTNAME = options["--hostname"] ?? "0.0.0.0";
const app = resolve(root, ".next/standalone");
await access(resolve(app, "server.js"));
await cp(resolve(root, "public"), resolve(app, "public"), { recursive: true });
await cp(resolve(root, ".next/static"), resolve(app, ".next/static"), {
  recursive: true,
});
await import(pathToFileURL(resolve(app, "server.js")).href);
