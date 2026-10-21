import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const id = "f6000000-0000-4000-8000-000000000001",
  category = "f6000000-0000-4000-8000-000000000002",
  branch = "f6000000-0000-4000-8000-000000000003",
  plan = "f6000000-0000-4000-8000-000000000004";
test("páginas públicas têm estados seguros e acessíveis sem configuração", async ({
  page,
  request,
}) => {
  for (const path of [
    "/catalogo",
    "/categorias",
    "/contato",
    "/politicas",
    "/reservar",
    "/consultar-reserva",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (path === "/reservar")
      await expect(page.locator("main [role=alert]")).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  for (const path of ["session", "quotes", "reservations"]) {
    const r = await request.post(`/api/v1/public/${path}`, {
      data: { total: "0.01", role: "ADMIN" },
    });
    expect(r.status()).toBe(503);
    expect(r.headers()["cache-control"]).toContain("no-store");
  }
});
test("formulário público: cotar, declarar dados, solicitar e consultar por token — HTTP adapters de teste", async ({
  page,
}, testInfo) => {
  const requests: unknown[] = [];
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?*",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: "window.turnstile={render:function(el,o){el.textContent='Verificação de teste concluída';setTimeout(function(){o.callback('test-'+o.action)},20);return 'test-widget'},remove:function(){}};",
      }),
  );
  await page.route("**/api/v1/public/session", (route) =>
    route.fulfill({
      json: {
        data: {
          site: {
            enabled: true,
            name: "Somente fixture E2E",
            email: "test@example.invalid",
            phone: "85999999999",
            address: "Endereço fictício",
            terms: "Condições de teste sem efeito comercial.",
            privacy: "Política de teste sem efeito comercial.",
            terms_version: id,
          },
          site_key: "fixture-site",
          options: {
            branches: [{ id: branch, name: "Unidade teste" }],
            categories: [{ id: category, name: "Categoria teste" }],
            plans: [
              {
                id: plan,
                name: "Diário teste",
                timezone: "America/Fortaleza",
                unit: "DAY",
              },
            ],
            services: [],
          },
        },
      },
    }),
  );
  await page.route("**/api/v1/public/quotes", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        data: {
          id,
          total: "200.00",
          deposit: "500.00",
          available: 1,
          expires_at: "2033-01-01T00:00:00Z",
          items: [
            {
              kind: "RENTAL",
              description: "Diárias de teste",
              quantity: "2",
              total: "200.00",
            },
          ],
        },
      },
    });
  });
  await page.route("**/api/v1/public/reservations", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      json: { data: { id, status: "REQUESTED", lookup_token: "a".repeat(43) } },
    });
  });
  await page.route(
    `**/api/v1/public/reservations/${id}/status`,
    async (route) => {
      expect(route.request().headers()["x-reservation-token"]).toBe(
        "a".repeat(43),
      );
      expect(route.request().url()).not.toContain("token=");
      await route.fulfill({
        json: {
          data: { id, status: "REQUESTED", updated_at: "2030-01-01T00:00:00Z" },
        },
      });
    },
  );
  await page.goto("/reservar");
  await page
    .getByRole("combobox", { name: "Unidade", exact: true })
    .selectOption(branch);
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(category);
  await page
    .getByRole("combobox", { name: "Plano e fuso dos horários", exact: true })
    .selectOption(plan);
  await page.getByLabel("Data e hora da retirada").fill("2030-01-01T10:00");
  await page.getByLabel("Data e hora da devolução").fill("2030-01-03T10:00");
  await expect(
    page.getByRole("button", { name: "Calcular minha cotação" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Calcular minha cotação" }).click();
  await expect(page.getByText("Total: R$ 200,00")).toBeVisible();
  await page
    .getByLabel("Nome completo ou razão social")
    .fill("Cliente exclusivamente de teste");
  await page.getByLabel("CPF ou CNPJ").fill("52998224725");
  await page.getByLabel("E-mail", { exact: true }).fill("test@example.invalid");
  await page
    .getByLabel("Telefone com DDD", { exact: true })
    .fill("85999999999");
  const customer = page.getByRole("group", { name: "Endereço do cliente" });
  for (const [label, value] of [
    ["CEP", "60000000"],
    ["Logradouro", "Rua de teste"],
    ["Número", "1"],
    ["Bairro", "Centro"],
    ["Cidade", "Fortaleza"],
    ["UF", "CE"],
  ])
    await customer.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel(/Li e aceito/).check();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("public-quote.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Solicitar reserva para análise" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Solicitação recebida" }),
  ).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(
    (requests[0] as { input: Record<string, unknown> }).input,
  ).not.toHaveProperty("total");
  expect((requests[1] as { accepted: boolean }).accepted).toBe(true);
  await page
    .getByRole("link", { name: "Consultar solicitação", exact: true })
    .last()
    .click();
  await page.getByLabel("Referência da solicitação").fill(id);
  await page.getByLabel("Token de consulta").fill("a".repeat(43));
  await page.getByRole("button", { name: "Consultar situação" }).click();
  await expect(page.getByRole("status")).toContainText("Solicitada");
  expect(page.url()).not.toContain("token");
});
