import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
test("avisos: leitura explícita, falha recuperável e vazio", async ({
  page,
}) => {
  await page.goto("/admin/notificacoes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Notificações", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Marcar como lida" }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Marcar como lida" }).first().click();
  await expect(page.getByRole("alert")).toContainText("não grava dados");
  await expect(
    page.getByRole("button", { name: "Marcar como lida" }).first(),
  ).toBeEnabled();
  await check(page);
  await page.goto("/admin/notificacoes?empty=1");
  await expect(
    page.getByRole("heading", { name: "Nenhum aviso disponível" }),
  ).toBeVisible();
  await check(page);
});
test("avisos: paginação e configuração obedecem o perfil ilustrativo", async ({
  page,
}) => {
  await page.goto("/admin/notificacoes?more=1");
  await page
    .getByRole("navigation", { name: "Paginação de notificações" })
    .getByRole("link", { name: "Próxima" })
    .click();
  await expect(page).toHaveURL(/page=2/);
  await expect(
    page.getByRole("navigation", { name: "Paginação de notificações" }),
  ).toContainText("Página 2");
  await page.goto("/admin/notificacoes?readonly=1");
  await expect(
    page.getByRole("link", { name: "Mensagens, regras e filas" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Marcar como lida" }),
  ).toHaveCount(2);
  await page.goto("/admin/notificacoes/configuracao?readonly=1");
  await expect(
    page.getByRole("heading", { name: "Acesso restrito" }),
  ).toBeVisible();
});
test("regras: e-mail limita evento, destinatário e modelo e não presume habilitação", async ({
  page,
}) => {
  await page.goto("/admin/notificacoes/configuracao");
  await page
    .locator("summary")
    .filter({ hasText: /^Editar regra: Reserva solicitada$/ })
    .click();
  await expect(
    page
      .getByRole("form", {
        name: "Salvar regra: Reserva solicitada",
        exact: true,
      })
      .getByRole("button", {
        name: "Salvar regra: Reserva solicitada",
        exact: true,
      }),
  ).toBeVisible();
  const form = await open(page, "Cadastrar regra de notificação");
  await form.getByRole("combobox", { name: /^Canal/ }).selectOption("EMAIL");
  await expect(
    form.getByRole("combobox", { name: /^Evento/ }).locator("option"),
  ).not.toContainText(["Manutenção"]);
  const values = await form
    .getByRole("combobox", { name: /^Evento/ })
    .locator("option")
    .evaluateAll((options) =>
      options.map((o) => (o as HTMLOptionElement).value),
    );
  expect(values.every((v) => /^(reservation|rental)\./.test(v))).toBe(true);
  await expect(
    form.getByRole("combobox", { name: /^Destinatário/ }),
  ).toHaveValue("CUSTOMER");
  await expect(form.getByRole("checkbox")).not.toBeChecked();
  await form
    .getByRole("combobox", { name: /^Modelo/ })
    .selectOption({ index: 1 });
  await form
    .getByRole("button", {
      name: "Cadastrar regra de notificação",
      exact: true,
    })
    .click();
  await expect(form.getByRole("alert")).toContainText("não grava dados");
  await check(page);
});
test("configuração: mensagens imutáveis, processamento e retentativa com motivo", async ({
  page,
}) => {
  await page.goto("/admin/notificacoes/configuracao");
  const emailFailure = page
    .locator(".notification-job")
    .filter({ hasText: "EMAIL_NOT_CONFIGURED" });
  await expect(emailFailure).toContainText(
    "O envio de e-mails ainda não foi configurado.",
  );
  await expect(
    emailFailure.getByText("Código para suporte: EMAIL_NOT_CONFIGURED", {
      exact: true,
    }),
  ).not.toBeVisible();
  await expect(
    page.getByText("E-mail sem configuração completa", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Processar alertas e notificações",
      exact: true,
    })
    .click();
  await expect(page.getByRole("alert")).toContainText("não grava dados");
  const retry = page
    .locator(".notification-job")
    .filter({ hasText: "DEMO_PROCESSING_FAILURE" });
  await retry
    .locator("summary")
    .filter({ hasText: /^Reagendar processamento$/ })
    .click();
  await retry
    .getByLabel("Motivo ou fundamentação", { exact: true })
    .fill("Revisão ilustrativa da falha de processamento.");
  await retry
    .getByRole("button", { name: "Reagendar processamento", exact: true })
    .click();
  await expect(retry.getByRole("alert")).toContainText("não grava dados");
  await page
    .locator("summary")
    .filter({ hasText: /^demonstracao.reserva/ })
    .click();
  await expect(page.locator(".notification-template").first()).toContainText(
    "{reference}",
  );
  await check(page);
});
test("equipe: situação, cargo e acesso editável preservam valores sem salvar na prévia", async ({
  page,
}) => {
  await page.goto("/admin/usuarios");
  const entry = page
    .locator(".team-entry")
    .filter({ hasText: "Financeiro de demonstração" });
  await expect(entry).toContainText("Inativo");
  await entry
    .locator("summary")
    .filter({ hasText: /^Editar acesso/ })
    .click();
  await expect(entry.getByRole("combobox", { name: /^Cargo/ })).toHaveValue(
    "FINANCE",
  );
  await expect(
    entry.getByRole("checkbox", { name: "Acesso ativo" }),
  ).not.toBeChecked();
  await entry.getByRole("combobox", { name: /^Cargo/ }).selectOption("MANAGER");
  await entry.getByRole("button", { name: "Salvar acesso" }).click();
  await expect(entry.getByRole("alert")).toContainText(
    "Não foi possível salvar",
  );
  await check(page);
});
test("equipe: erro de servidor, vazio e acesso restrito", async ({ page }) => {
  await page.goto("/admin/usuarios?resultado=erro");
  await expect(page.getByRole("alert")).toContainText(
    "outro administrador ativo",
  );
  await check(page);
  await page.goto("/admin/usuarios?empty=1");
  await expect(
    page.getByRole("heading", { name: "Nenhum funcionário encontrado" }),
  ).toBeVisible();
  await check(page);
  await page.goto("/admin/usuarios?readonly=1");
  await expect(
    page.getByRole("heading", { name: "Acesso restrito" }),
  ).toBeVisible();
});
test("site: publicação desabilitada, políticas exigidas e erro não afirma sucesso", async ({
  page,
}) => {
  await page.goto("/admin/site");
  const form = page.getByRole("form", {
    name: "Publicação do site",
    exact: true,
  });
  await expect(form.getByRole("checkbox")).not.toBeChecked();
  await expect(form.locator('textarea[name="terms"]')).toHaveAttribute(
    "minlength",
    "30",
  );
  await expect(form.locator('textarea[name="privacy"]')).toHaveAttribute(
    "required",
    "",
  );
  await form.getByRole("button", { name: "Salvar publicação" }).click();
  await expect(form.getByRole("alert")).toContainText("não grava dados");
  await expect(form.getByRole("status")).toHaveCount(0);
  await check(page);
});
test("configurações vazias não inventam textos, versões ou regras", async ({
  page,
}) => {
  await page.goto("/admin/site?empty=1");
  await expect(
    page.getByRole("textbox", { name: "Nome público da locadora" }),
  ).toHaveValue("");
  await expect(page.locator('textarea[name="terms"]')).toHaveValue("");
  await expect(
    page.getByText("Versão atual: 0.", { exact: false }),
  ).toBeVisible();
  await check(page);
  await page.goto("/admin/notificacoes/configuracao?empty=1");
  await expect(
    page.getByText("Nenhuma versão de mensagem cadastrada."),
  ).toBeVisible();
  await expect(page.locator(".notification-rule")).toHaveCount(0);
  await check(page);
  await page.goto("/admin/site?readonly=1");
  await expect(
    page.getByRole("heading", { name: "Acesso restrito" }),
  ).toBeVisible();
});
