import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (
  !url ||
  !key ||
  !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname)
)
  throw new Error(
    "A suíte real exige Supabase local e chave publicável. Nenhum projeto remoto é alterado.",
  );
const users = Object.fromEntries(
  ["ADMIN", "ATTENDANT", "FINANCE"].map((role) => {
    const email = process.env[`E2E_${role}_EMAIL`],
      password = process.env[`E2E_${role}_PASSWORD`];
    if (!email || !password)
      throw new Error(
        `Credenciais fictícias locais ausentes: E2E_${role}_EMAIL/PASSWORD`,
      );
    return [role, { email, password }];
  }),
);
async function login(page: Page, role: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(users[role].email);
  await page.getByLabel("Senha", { exact: true }).fill(users[role].password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
}
test("login real persiste SSR e logout revoga a sessão usada pelo painel", async ({
  page,
}) => {
  await login(page, "ADMIN");
  await page.reload();
  const response = await page.request.get("/api/v1/admin/session");
  expect(response.status()).toBe(200);
  expect((await response.json()).data.roles).toContain("ADMIN");
  const cookies = await page.context().cookies();
  expect(
    cookies
      .filter((c) => c.name.includes("auth-token"))
      .every((c) => c.httpOnly),
  ).toBe(true);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  expect((await page.request.get("/api/v1/admin/session")).status()).toBe(401);
});
test("financeiro e atendente recebem somente domínios autorizados em HTTP real", async ({
  browser,
}) => {
  for (const role of ["FINANCE", "ATTENDANT"]) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await login(page, role);
      const financial = await page.request.get("/api/v1/admin/finance");
      expect(financial.status()).toBe(role === "FINANCE" ? 200 : 403);
      const dashboard = await page.request.get("/api/v1/admin/dashboard");
      expect(dashboard.status()).toBe(200);
      const body = await dashboard.json();
      expect(Boolean(body.finance)).toBe(role === "FINANCE");
      expect(Boolean(body.operations)).toBe(role === "ATTENDANT");
    } finally {
      await context.close();
    }
  }
});
test("PostgREST real recusa escrita de ledger e Storage anônimo não lista documentos", async () => {
  const client = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const auth = await client.auth.signInWithPassword(users.FINANCE);
  expect(auth.error).toBeNull();
  const denied = await client.from("payments").insert({ amount: 1 });
  expect(denied.error).not.toBeNull();
  const privileged = await client.rpc("operational_readiness");
  expect(privileged.error).not.toBeNull();
  const anon = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const storage = await anon.storage.from("documents").list();
  expect(storage.data ?? []).toHaveLength(0);
  await client.auth.signOut();
});
