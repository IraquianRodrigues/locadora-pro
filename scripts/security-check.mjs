import ts from "typescript";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import { format } from "prettier";
const root = process.cwd(),
  issues = [],
  sources = new Map(),
  inventory = [];
async function walk(folder) {
  let result = [];
  for (const e of await readdir(folder, { withFileTypes: true })) {
    const path = resolve(folder, e.name);
    if (e.isDirectory()) result.push(...(await walk(path)));
    else if (/\.(tsx?|mjs|ya?ml|json|md)$/.test(path)) result.push(path);
  }
  return result;
}
const files = [
  ...(await walk(resolve(root, "src"))),
  ...(await walk(resolve(root, "scripts"))),
  ...(await walk(resolve(root, "docs"))),
  ...(await walk(resolve(root, ".github"))),
  ...(await walk(resolve(root, "assets"))),
];
for (const file of files) {
  const text = await readFile(file, "utf8"),
    name = relative(root, file).replaceAll("\\", "/");
  // Somente nomes de arquivo/regra são emitidos; nunca imprimir o conteúdo detectado.
  if (
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) ||
    /\bAKIA[A-Z0-9]{16}\b/.test(text) ||
    /sb_secret_[a-zA-Z0-9_-]{24,}/.test(text)
  )
    issues.push(`${name}:possible-secret`);
  if (name.startsWith("src/") && /\.tsx?$/.test(file)) {
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true),
      imports = [];
    for (const s of tree.statements)
      if (
        ts.isImportDeclaration(s) &&
        ts.isStringLiteral(s.moduleSpecifier) &&
        !s.importClause?.isTypeOnly
      ) {
        if (
          s.importClause?.namedBindings &&
          ts.isNamedImports(s.importClause.namedBindings) &&
          !s.importClause.name &&
          s.importClause.namedBindings.elements.every((e) => e.isTypeOnly)
        )
          continue;
        imports.push(s.moduleSpecifier.text);
      }
    const directives = tree.statements
      .filter(ts.isExpressionStatement)
      .filter((s) => ts.isStringLiteral(s.expression))
      .map((s) => s.expression.text);
    sources.set(file, {
      text,
      imports,
      client: directives.includes("use client"),
      server: directives.includes("use server"),
    });
    if (name.startsWith("src/app/api/") && name.endsWith("/route.ts")) {
      const methods = tree.statements
        .filter(
          (s) =>
            ts.isFunctionDeclaration(s) &&
            s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword),
        )
        .map((s) => s.name?.text)
        .filter((m) =>
          ["GET", "POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"].includes(
            m,
          ),
        );
      const path =
        "/" +
        name
          .slice("src/app/".length, -"/route.ts".length)
          .replaceAll(/\[([^\]]+)\]/g, "{$1}");
      const boundary = path.startsWith("/api/v1/admin/")
        ? "staff-session-rbac"
        : path.startsWith("/api/internal/")
          ? "server-bearer"
          : "public-allowlist";
      if (
        path.startsWith("/api/internal/") &&
        !/authorization|internalAuthorization/i.test(text)
      )
        issues.push(`${name}:missing-internal-boundary`);
      if (
        path.startsWith("/api/v1/public/") &&
        ![
          "/api/v1/public/categories",
          "/api/v1/public/vehicles",
          "/api/v1/public/vehicles/{id}",
          "/api/v1/public/images/{id}",
          "/api/v1/public/session",
          "/api/v1/public/quotes",
          "/api/v1/public/reservations",
          "/api/v1/public/reservations/{id}/status",
        ].includes(path)
      )
        issues.push(`${name}:unreviewed-public-route`);
      inventory.push({ path, methods, boundary, file: name });
    }
  }
}
function localImport(file, spec) {
  const base = spec.startsWith("@/")
    ? resolve(root, "src", spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(file), spec)
      : null;
  if (!base) return null;
  for (const candidate of [
    base,
    base + ".ts",
    base + ".tsx",
    resolve(base, "index.ts"),
  ])
    if (sources.has(candidate)) return candidate;
  return null;
}
for (const [entry, source] of sources)
  if (source.client) {
    const visited = new Set();
    function visit(file) {
      if (visited.has(file)) return;
      visited.add(file);
      const node = sources.get(file);
      if (!node || node.server) return;
      if (
        node.imports.includes("server-only") ||
        /process\.env\.(?:SUPABASE_SERVICE_ROLE_KEY|AUTH_SECRET|RESEND_API_KEY|TURNSTILE_SECRET_KEY|READINESS_SECRET)/.test(
          node.text,
        )
      )
        issues.push(
          `${relative(root, entry)}:server-code-reachable:${relative(root, file)}`,
        );
      for (const spec of node.imports) {
        const target = localImport(file, spec);
        if (target) visit(target);
      }
    }
    visit(entry);
  }
inventory.sort((a, b) => a.path.localeCompare(b.path));
await writeFile(
  resolve(root, "docs/security/endpoints.json"),
  await format(
    JSON.stringify({
      description:
        "Inventário estático; não substitui testes de autorização HTTP/JWT. Server Actions e callback Auth são revisados separadamente.",
      routes: inventory,
    }),
    { parser: "json" },
  ),
);
if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Segurança estática: ${sources.size} módulos, ${inventory.length} rotas inventariadas; sem achados nas regras verificadas.`,
  );
