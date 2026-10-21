import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const id = "50000001-0000-4000-8000-000000000001";
const active = "50000002-0000-4000-8000-000000000002";
async function check(page: import("@playwright/test").Page) {
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
test("locações: filtro, vazio, consulta e acessibilidade", async ({ page }) => {
  await page.goto("/admin/locacoes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Locações", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await check(page);
  await page
    .getByRole("combobox", { name: /^Situação/ })
    .selectOption("OVERDUE");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(
    page.getByText("Verificar devolução e próximas reservas", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.goto("/admin/locacoes?empty=1");
  await expect(
    page.getByRole("heading", { name: "Nenhuma locação encontrada" }),
  ).toBeVisible();
  await page.goto("/admin/locacoes?readonly=1");
  await expect(
    page.getByRole("link", { name: "Nova locação direta" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Regras e modelos", exact: true }),
  ).toHaveCount(0);
});
test("preparação: ações expansíveis preservam pré-requisitos e falha recuperável", async ({
  page,
}) => {
  await page.goto(`/admin/locacoes/${id}`);
  for (const name of ["Operação", "Logística", "Vistorias", "Contratos"])
    await expect(
      page
        .getByRole("navigation", { name: "Seções da locação" })
        .getByRole("link", { name, exact: true }),
    ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: /^Confirmar retirada$/ })
    .click();
  const form = page.getByRole("form", {
    name: "Confirmar retirada",
    exact: true,
  });
  await expect(form).toContainText("Exige condutores válidos");
  await form
    .getByRole("button", { name: "Confirmar retirada", exact: true })
    .click();
  await expect(form.getByRole("status")).toContainText("não grava dados");
  await expect(form.getByRole("button")).toBeEnabled();
  await check(page);
});
test("vistoria: respostas e evidências mantêm controles e envio autorizado", async ({
  page,
}) => {
  await page.goto(`/admin/locacoes/${id}#vistorias`);
  const group = page.getByRole("group", {
    name: "Pintura e lataria · foto obrigatória",
  });
  await group
    .getByRole("combobox", { name: /^Condição/ })
    .selectOption("DAMAGE");
  await group
    .getByRole("textbox", { name: /^Descrição/ })
    .fill("Avaria ilustrativa para avaliação.");
  const form = page.getByRole("form", {
    name: "Salvar respostas da vistoria",
    exact: true,
  });
  await form
    .getByRole("button", { name: "Salvar respostas da vistoria", exact: true })
    .click();
  await expect(form.getByRole("status")).toContainText("não grava dados");
  await page.getByRole("button", { name: "Abrir foto", exact: true }).click();
  await expect(page.getByText(/Prévia visual: esta ação/).last()).toBeVisible();
  await expect(
    page.getByLabel("Foto do item (até 4 MiB)").first(),
  ).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
  await check(page);
});
test("contratos: arquivo temporário e reagendamento não simulam sucesso", async ({
  page,
}) => {
  await page.goto(`/admin/locacoes/${id}#contratos`);
  await page
    .getByRole("button", { name: "Abrir contrato · versão 2", exact: true })
    .click();
  await expect(
    page
      .locator(".rental-file-control")
      .filter({ hasText: "Abrir contrato" })
      .getByRole("status"),
  ).toContainText("não grava dados");
  await expect(page.getByRole("link", { name: "Baixar arquivo" })).toHaveCount(
    0,
  );
  await page
    .locator("summary")
    .filter({ hasText: /^Reagendar contrato com falha$/ })
    .click();
  const form = page.getByRole("form", {
    name: "Reagendar contrato com falha",
    exact: true,
  });
  await form.getByRole("button").click();
  await expect(form.getByRole("status")).toContainText("não grava dados");
  await check(page);
});
test("devolução e prorrogação usam estado atual e data local", async ({
  page,
}) => {
  await page.goto(`/admin/locacoes/${active}`);
  await expect(
    page.locator("summary").filter({ hasText: /^Confirmar retirada$/ }),
  ).toHaveCount(0);
  await page
    .locator("summary")
    .filter({ hasText: /^Apurar e confirmar devolução$/ })
    .click();
  await expect(
    page.getByRole("form", {
      name: "Apurar e confirmar devolução",
      exact: true,
    }),
  ).toContainText("financeiro");
  await page
    .getByRole("combobox", { name: /^Plano de prorrogação/ })
    .selectOption({ index: 1 });
  await page
    .getByLabel("Nova data e hora de devolução", { exact: true })
    .fill("2026-10-28T09:00");
  await page
    .getByRole("button", { name: "Cotar prorrogação", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("não grava dados");
  await expect(
    page.getByRole("button", { name: "Cotar prorrogação", exact: true }),
  ).toBeEnabled();
  await check(page);
  await page.goto(`/admin/locacoes/${active}?readonly=1`);
  await expect(page.getByRole("form")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Abrir contrato · versão 2" }),
  ).toBeVisible();
});
test("locação direta e configurações mantêm identidade e campos", async ({
  page,
}) => {
  await page.goto("/admin/locacoes/nova");
  await expect(
    page.getByRole("heading", { level: 1, name: "Nova locação direta" }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Data e hora da retirada/)).toHaveAttribute(
    "type",
    "datetime-local",
  );
  await expect(
    page.getByRole("combobox", { name: "Veículo", exact: true }),
  ).toHaveAttribute("required", "");
  await expect(
    page.getByRole("combobox", { name: "Cliente", exact: true }),
  ).toHaveAttribute("required", "");
  await expect(page.getByRole("combobox", { name: /Categoria/ })).toHaveCount(
    0,
  );
  await check(page);
  await page.goto("/admin/locacoes/configuracao");
  await expect(
    page.getByRole("form", { name: "Salvar regras operacionais", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(/Confirmo que esta versão/)).not.toBeChecked();
  await check(page);
});
