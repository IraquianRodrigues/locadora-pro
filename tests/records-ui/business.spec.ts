import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const scheduled = "60000001-0000-4000-8000-000000000001",
  active = "60000002-0000-4000-8000-000000000002",
  closed = "60000003-0000-4000-8000-000000000003";
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
async function open(page: Page, title: string) {
  await page
    .locator("summary")
    .filter({ hasText: new RegExp(`^${title}$`) })
    .click();
  return page.getByRole("form", { name: title, exact: true });
}
test("financeiro: registros separados, vazio e consulta sem ações", async ({
  page,
}) => {
  await page.goto("/admin/financeiro");
  await expect(
    page.getByRole("heading", { level: 1, name: "Financeiro", exact: true }),
  ).toBeVisible();
  await check(page);
  await page
    .getByRole("navigation", { name: "Registros financeiros" })
    .getByRole("link", { name: "Cauções", exact: true })
    .click();
  await expect(page.locator(".finance-entry")).toContainText("R$ 800,00");
  await check(page);
  await page.goto("/admin/financeiro?readonly=1");
  await expect(page.locator("main details:has(form)")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Novo lançamento" })).toHaveCount(
    0,
  );
  await page.goto("/admin/financeiro?empty=1");
  await expect(
    page.getByRole("heading", { name: "Nenhum lançamento encontrado" }),
  ).toBeVisible();
});
test("financeiro: recebimento exige confirmação e recusa local não registra sucesso", async ({
  page,
}) => {
  await page.goto("/admin/financeiro");
  const form = await open(page, "Receber nesta cobrança");
  await form
    .getByRole("combobox", { name: /^Meio utilizado/ })
    .selectOption({ index: 1 });
  await form.getByLabel(/Valor \(R\$/).fill("100.00");
  const confirmation = form.getByRole("checkbox");
  await expect(confirmation).not.toBeChecked();
  await expect(confirmation).toHaveAttribute("required", "");
  await confirmation.check();
  await form
    .getByRole("button", { name: "Receber nesta cobrança", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText("não grava dados");
  await expect(
    form.getByRole("button", { name: "Receber nesta cobrança", exact: true }),
  ).toBeEnabled();
  await check(page);
});
test("financeiro: novas cobranças usam data local e configuração não presume limites", async ({
  page,
}) => {
  await page.goto("/admin/financeiro#novos-lancamentos");
  const form = await open(page, "Criar cobrança");
  await expect(form.getByLabel(/^Competência/)).toHaveAttribute(
    "type",
    "datetime-local",
  );
  await expect(form.getByLabel(/^Vencimento/)).toHaveAttribute(
    "type",
    "datetime-local",
  );
  await check(page);
  await page.goto("/admin/financeiro/configuracao");
  const config = await open(page, "Salvar limites de desconto financeiro");
  await expect(
    config.getByLabel("Limite do administrador", { exact: true }),
  ).toHaveValue("");
  await expect(
    config.getByLabel("Limite do administrador", { exact: true }),
  ).toHaveAttribute("max", "10000");
  await check(page);
});
test("manutenção: alertas, filtro, vazio e acesso por perfil", async ({
  page,
}) => {
  await page.goto("/admin/manutencao");
  await expect(page.getByRole("table")).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: /Alertas por data/ })
    .click();
  await expect(
    page.getByRole("link", { name: /com prazo ultrapassado/ }),
  ).toBeVisible();
  await check(page);
  await page
    .getByRole("combobox", { name: /^Situação/ })
    .selectOption("IN_PROGRESS");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.goto("/admin/manutencao?empty=1");
  await expect(
    page.getByRole("heading", { name: "Nenhuma manutenção encontrada" }),
  ).toBeVisible();
  await page.goto("/admin/manutencao?readonly=1");
  await expect(
    page.getByRole("link", { name: "Agendar manutenção", exact: true }),
  ).toHaveCount(0);
});
test("manutenção: agendamento nativo preserva bloqueio e falha recuperável", async ({
  page,
}) => {
  await page.goto("/admin/manutencao/nova");
  const form = page.getByRole("form", {
    name: "Agendar manutenção",
    exact: true,
  });
  await form
    .getByRole("combobox", { name: /^Veículo/ })
    .selectOption({ index: 1 });
  await form
    .getByLabel("Quilometragem informada", { exact: true })
    .fill("12600");
  await form.getByLabel(/^Início/).fill("2026-10-24T09:00");
  await form.getByLabel(/^Fim previsto/).fill("2026-10-25T09:00");
  await form
    .getByLabel("Descrição do serviço", { exact: true })
    .fill("Serviço ilustrativo para revisão.");
  await expect(form.getByRole("checkbox")).toBeChecked();
  await form
    .getByRole("button", { name: "Agendar manutenção", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText("não grava dados");
  await check(page);
});
test("manutenção: reagendamento local, despesa opcional e encerramento imutável", async ({
  page,
}) => {
  await page.goto(`/admin/manutencao/${scheduled}`);
  const reschedule = await open(page, "Reagendar manutenção");
  await expect(reschedule.getByLabel(/^Novo início/)).toHaveValue(
    "2026-10-24T09:00",
  );
  await check(page);
  await page.goto(`/admin/manutencao/${active}`);
  const complete = await open(page, "Concluir manutenção");
  await complete
    .locator("summary")
    .filter({ hasText: /Registrar despesa junto/ })
    .click();
  await expect(
    complete.getByRole("checkbox", { name: /Incluir despesa/ }),
  ).not.toBeChecked();
  await expect(
    complete.getByRole("checkbox", { name: /Confirmo o pagamento/ }),
  ).not.toBeChecked();
  await check(page);
  await page.goto(`/admin/manutencao/${closed}`);
  await expect(page.getByRole("form")).toHaveCount(0);
  await expect(page.getByText(/Serviço encerrado/)).toBeVisible();
  await page.goto(`/admin/manutencao/${active}?readonly=1`);
  await expect(page.getByRole("form")).toHaveCount(0);
});
test("relatórios: tipos financeiros, valores assinados, página CSV e período", async ({
  page,
}) => {
  for (const kind of [
    "REVENUE",
    "RECEIPTS",
    "EXPENSES",
    "PROFITABILITY",
    "BALANCES",
  ]) {
    await page.goto(`/admin/relatorios?kind=${kind}`);
    await expect(page.getByRole("table")).toBeVisible();
    await check(page);
  }
  await page.goto("/admin/relatorios?kind=RECEIPTS");
  await expect(page.getByRole("table")).toContainText("R$ -50,00");
  await expect(
    page.getByRole("button", { name: /Exportar esta página/ }),
  ).toBeDisabled();
  await expect(page.locator('main a[href^="/api/"]')).toHaveCount(0);
  await page.getByLabel("De", { exact: true }).fill("2026-10-10");
  await page.getByRole("button", { name: "Atualizar período" }).click();
  await expect(page).toHaveURL(/from=2026-10-10/);
});
test("relatórios: operação, nomes extensos, cobertura, vazio e período inválido", async ({
  page,
}) => {
  for (const kind of [
    "RESERVATIONS",
    "OCCUPANCY",
    "RECURRING",
    "OVERDUE",
    "MAINTENANCE",
  ]) {
    await page.goto(`/admin/relatorios?kind=${kind}`);
    await expect(page.getByRole("table")).toBeVisible();
    await check(page);
  }
  await page.goto("/admin/relatorios?operations=1&kind=OCCUPANCY");
  await expect(
    page
      .getByRole("combobox", { name: /Relatório/ })
      .locator('option[value="REVENUE"]'),
  ).toHaveCount(0);
  await expect(page.getByRole("table")).toContainText("Sim");
  await page.goto("/admin/relatorios?empty=1");
  await expect(
    page.getByRole("heading", { name: "Nenhum registro no período" }),
  ).toBeVisible();
  await page.goto("/admin/relatorios?from=2026-01-01&to=2028-01-01");
  await expect(page.getByRole("alert")).toContainText("366 dias");
});
