import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const id = "10000001-0000-4000-8000-000000000001";
for (const [resource, title] of [
  ["frota", "Frota"],
  ["clientes", "Clientes"],
  ["condutores", "Condutores"],
  ["reservas", "Reservas"],
]) {
  test(`${title}: consulta responsiva, situação e acessibilidade`, async ({
    page,
  }) => {
    await page.goto(`/admin/${resource}`);
    await expect(
      page.getByRole("heading", { level: 1, name: title, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
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
    if (resource === "clientes" || resource === "condutores")
      await expect(page.locator("main")).not.toContainText("11144477735");
    await page.goto(`/admin/${resource}?empty=1`);
    await expect(
      page.getByRole("heading", { level: 2, name: /Nenhum/ }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    await page.goto(`/admin/${resource}?readonly=1`);
    await expect(
      page.locator('main a[href$="/novo"],main a[href$="/nova"]'),
    ).toHaveCount(0);
  });
}
test("formulários mantêm grupos, foco de erro e validação brasileira", async ({
  page,
}) => {
  await page.goto("/admin/frota/novo");
  await expect(
    page.getByRole("group", { name: "Identificação do veículo", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Salvar cadastro", exact: true })
    .click();
  await expect(page.getByLabel("Placa", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Placa", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("[role=alert]").first()).toBeVisible();
  for (const resource of ["clientes", "condutores"]) {
    await page.goto(`/admin/${resource}/novo`);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto(`/admin/clientes/${id}?readonly=1`);
  await expect(
    page.getByRole("button", { name: "Salvar cadastro", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Nome / razão social", { exact: true }),
  ).toBeDisabled();
});
test("cotação usa datas locais e logística condicional sem executar ação real", async ({
  page,
}) => {
  await page.goto("/admin/reservas/nova");
  await page.getByLabel("Plano tarifário", { exact: true }).selectOption(id);
  await page.getByLabel("Unidade", { exact: true }).selectOption(id);
  await page
    .getByRole("combobox", { name: /^Categoria \(ou veículo\)/ })
    .selectOption(id);
  await page
    .getByLabel("Data e hora da retirada", { exact: false })
    .fill("2026-10-24T09:00");
  await page
    .getByLabel("Data e hora da devolução", { exact: false })
    .fill("2026-10-26T09:00");
  await page
    .getByRole("combobox", { name: /^Retirada/ })
    .selectOption("DELIVERY");
  await expect(
    page.getByRole("group", { name: "Endereço de entrega", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: /^Retirada/ })
    .selectOption("BRANCH");
  await expect(
    page.getByRole("group", { name: "Endereço de entrega", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Calcular cotação", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Prévia visual: esta ação não grava dados.",
  );
  await expect(
    page.getByRole("button", { name: "Calcular cotação", exact: true }),
  ).toBeEnabled();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test("detalhe separa caução e decisão e respeita consulta sem ações", async ({
  page,
}) => {
  const path = "/admin/reservas/30000001-0000-4000-8000-000000000001";
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Analisar reserva", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Caução separada", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.goto(path + "?readonly=1");
  await expect(
    page.getByRole("button", { name: "Registrar decisão", exact: true }),
  ).toHaveCount(0);
});
