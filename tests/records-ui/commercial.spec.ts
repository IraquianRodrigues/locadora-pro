import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const id = "10000001-0000-4000-8000-000000000001";
async function check(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}
for (const [resource, title, marker] of [
  ["categorias", "Categorias", "5 passageiro(s)"],
  ["unidades", "Unidades", "Ativo"],
  ["planos", "Planos tarifários", "Diária"],
  ["precos", "Preços e vigências", "R$ 180,00"],
  ["adicionais", "Serviços adicionais", "Uma vez por locação"],
]) {
  test(`${title}: lista, cadastro, consulta e vazio`, async ({ page }) => {
    await page.goto(`/admin/${resource}`);
    await expect(
      page.getByRole("heading", { level: 1, name: title, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".records-table")).toContainText(marker);
    await check(page);
    await page.locator(".page-heading").getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`/admin/${resource}/novo$`));
    await check(page);
    await page.goto(`/admin/${resource}/${id}?readonly=1`);
    await expect(
      page.getByRole("button", { name: "Salvar cadastro" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Arquivar cadastro" }),
    ).toHaveCount(0);
    await check(page);
    await page.goto(`/admin/${resource}?empty=1`);
    await expect(
      page.getByRole("heading", { name: "Nenhum cadastro encontrado" }),
    ).toBeVisible();
    await check(page);
  });
}
test("categoria e unidade validam capacidade e endereço brasileiros", async ({
  page,
}) => {
  await page.goto(`/admin/categorias/${id}`);
  await page.getByLabel("Capacidade de passageiros", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByLabel("Capacidade de passageiros", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await check(page);
  await page.goto(`/admin/unidades/${id}`);
  await page.getByLabel("CEP", { exact: true }).fill("123");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(page.getByRole("alert")).toContainText("CEP com 8 dígitos");
  await page.getByLabel("CEP", { exact: true }).fill("60000-000");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(page.getByRole("alert")).toContainText("não grava dados");
  await check(page);
});
test("plano preserva semântica mensal e não publica automaticamente", async ({
  page,
}) => {
  await page.goto(`/admin/planos/${id}`);
  await expect(
    page.getByLabel("Publicar este plano no site", { exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole("combobox", { name: "Período principal", exact: true })
    .selectOption("MONTH");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Defina mês calendário" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: /^Modo mensal/ })
    .selectOption("COMMERCIAL");
  await page.getByLabel(/^Dias do mês comercial/).fill("30");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "não grava dados" }),
  ).toBeVisible();
  await check(page);
});
test("preço usa datas locais e exige categoria ou veículo exclusivamente", async ({
  page,
}) => {
  await page.goto(`/admin/precos/${id}`);
  await expect(
    page.getByLabel("Início da vigência", { exact: true }),
  ).toHaveAttribute("type", "datetime-local");
  await expect(
    page.getByLabel("Início da vigência", { exact: true }),
  ).toHaveValue("2026-10-01T00:00");
  await page.getByRole("combobox", { name: /^Veículo/ }).selectOption(id);
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "exclusivamente" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: /^Veículo/ }).selectOption("");
  await page
    .getByLabel("Fim exclusivo da vigência", { exact: true })
    .fill("2026-09-01T00:00");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "posterior ao início" }),
  ).toBeVisible();
  await page
    .getByLabel("Fim exclusivo da vigência", { exact: true })
    .fill("2026-11-01T00:00");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "não grava dados" }),
  ).toBeVisible();
  await check(page);
});
test("adicional aceita decimal brasileiro e arquivamento mantém consulta bloqueada", async ({
  page,
}) => {
  await page.goto(`/admin/adicionais/${id}`);
  await page.getByLabel("Valor unitário (R$)", { exact: true }).fill("25,90");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(page.getByRole("alert")).toContainText("não grava dados");
  await page.getByRole("button", { name: "Arquivar cadastro" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "não grava dados" }),
  ).toHaveCount(2);
  await page.goto(`/admin/adicionais/${id}?archived=1`);
  await expect(
    page.getByRole("button", { name: "Salvar cadastro" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Restaurar cadastro" }),
  ).toBeVisible();
  await check(page);
});
