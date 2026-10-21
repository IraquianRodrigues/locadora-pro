import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { URL, pathToFileURL } from "node:url";
import { build } from "vite";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
// Servidor de desenvolvimento separado. Não cria rota pública nem contorna Auth.
const root = process.cwd();
console.log("Preparando os componentes da prévia…");
const aliases = [
  ...[
    "registry/actions",
    "registry/file-actions",
    "public/admin-actions",
    "reservations/actions",
    "rentals/actions",
    "business/actions",
    "auth/actions",
  ].map((name) => ({
    find: `@/lib/${name}`,
    replacement: resolve(root, "scripts/preview/actions.ts"),
  })),
  { find: "@", replacement: resolve(root, "src") },
  { find: "next/link", replacement: resolve(root, "scripts/preview/link.tsx") },
  {
    find: "next/navigation",
    replacement: resolve(root, "scripts/preview/navigation.ts"),
  },
];
await build({
  configFile: false,
  logLevel: "error",
  resolve: {
    alias: aliases,
  },
  build: {
    ssr: resolve(root, "scripts/preview/frontend.tsx"),
    outDir: ".impeccable/preview",
    emptyOutDir: true,
  },
});
await build({
  configFile: false,
  logLevel: "error",
  resolve: { alias: aliases },
  build: {
    outDir: ".impeccable/preview/client",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(root, "scripts/preview/client.tsx"),
      output: { entryFileNames: "preview.js" },
    },
  },
});
const { renderDesignPreview } = await import(
  pathToFileURL(resolve(root, ".impeccable/preview/frontend.js"))
);
const css = await postcss([tailwind({ base: root })]).process(
  await readFile("src/app/globals.css", "utf8"),
  { from: resolve(root, "src/app/globals.css") },
);
const font = await readFile("assets/fonts/Manrope-Variable.ttf");
const client = await readFile(".impeccable/preview/client/preview.js");
const server = createHttpServer((req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }
  const url = new URL(req.url, "http://127.0.0.1");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (url.pathname === "/style.css") {
    res.setHeader("Content-Type", "text/css; charset=utf-8");
    res.end(css.css);
  } else if (url.pathname === "/font.ttf") {
    res.setHeader("Content-Type", "font/ttf");
    res.end(font);
  } else if (url.pathname === "/preview.js") {
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.end(client);
  } else if (
    url.pathname === "/" ||
    /^\/admin\/(dashboard|frota|clientes|condutores|reservas|locacoes|financeiro|manutencao|relatorios|notificacoes|usuarios|site|categorias|unidades|planos|precos|adicionais)(\/[^/]+)?$/.test(
      url.pathname,
    )
  ) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(renderDesignPreview(url.pathname + url.search));
  } else {
    res.writeHead(404);
    res.end();
  }
});
const previewPort = Number(process.env.PREVIEW_PORT ?? 3230);
if (!Number.isInteger(previewPort) || previewPort < 1 || previewPort > 65535)
  throw new Error("PREVIEW_PORT inválida");
server.listen(previewPort, "127.0.0.1", () =>
  console.log(
    `Prévia visual isolada: http://127.0.0.1:${previewPort}/ (dados ilustrativos, sem banco)`,
  ),
);
process.on("SIGINT", () => {
  server.close();
  process.exit(0);
});
