import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("site informa preparação sem permitir reserva e funciona no viewport", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Locação de veículos.",
  );
  await expect(
    page.getByText(
      "Este site ainda não recebe solicitações de reserva ou pagamentos.",
    ),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Ver disponibilidade do serviço" })
    .click();
  await expect(page).toHaveURL(/#disponibilidade$/);
  await expect(
    page.getByRole("heading", { name: "Estamos cuidando dos detalhes." }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator("form")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("home.png"),
    fullPage: true,
  });
});

test("painel fica fechado sem Supabase configurado e login informa a pendência", async ({
  page,
  request,
}, testInfo) => {
  for (const path of ["/admin", "/admin/dashboard", "/admin/financeiro"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    const location = new URL(
      response.headers().location,
      "http://127.0.0.1:3100",
    );
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe(path);
  }
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByText(/Acesso ainda indisponível/)).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath("login.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Voltar ao início" }).click();
  await expect(page).toHaveURL("/");
});

test("liveness não afirma conexão com banco e aplica cabeçalhos", async ({
  request,
}) => {
  const response = await request.get("/api/v1/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    data: { status: "ok", service: "locadora-pro" },
  });
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-powered-by"]).toBeUndefined();
});

test("atalho de teclado leva ao conteúdo e rota desconhecida retorna 404", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Pular para o conteúdo" }),
  ).toBeFocused();
  const response = await page.goto("/pagina-inexistente");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();
});

test("páginas públicas passam nas verificações automáticas de acessibilidade", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/login",
    "/recuperar-senha",
    "/auth/confirm",
    "/acesso-negado",
  ]) {
    await page.goto(path);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
});
