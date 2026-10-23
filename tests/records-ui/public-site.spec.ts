import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("site público: catálogo ilustrativo, vazio e preparação preservam estados e acessibilidade", async ({
  page,
}) => {
  for (const state of ["", "?empty=1", "?preparacao=1"]) {
    await page.goto(`/publico${state}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Locação de veículos.",
    );
    await expect(page.getByLabel("Ambiente de demonstração")).toContainText(
      "Dados ilustrativos",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (state.includes("preparacao")) {
      await expect(page.getByRole("search")).toHaveCount(0);
      await expect(
        page.getByText(
          "Este site ainda não recebe solicitações de reserva ou pagamentos.",
        ),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("search", { name: "Buscar veículos no catálogo" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Explorar catálogo", exact: true }),
      ).toHaveAttribute("href", /\/catalogo$/);
      if (state.includes("empty"))
        await expect(page.getByRole("status")).toContainText(
          "Nenhum veículo publicado",
        );
      else {
        await expect(
          page.getByText("Foto não publicada", { exact: true }),
        ).toHaveCount(3);
        await expect(
          page.getByRole("link", { name: "Cotar este veículo" }),
        ).toHaveCount(3);
        await expect(page.locator(".public-catalog-grid")).not.toContainText(
          "R$",
        );
      }
    }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
});

test("site público: menu móvel, foco e redução de movimento", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/publico");
  const action = page.getByRole("link", {
    name: "Explorar catálogo",
    exact: true,
  });
  await action.focus();
  await expect(action).toBeFocused();
  await expect(action.locator(".magic-hover-label")).toHaveCSS("opacity", "1");
  expect(
    await action
      .locator(".magic-hover-label")
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toMatch(/^(0s|1e-05s|0\.00001s|0\.01ms)$/);
  if (info.project.name === "mobile") {
    await page.getByText("Menu", { exact: true }).click();
    const nav = page.getByRole("navigation", { name: "Navegação móvel" });
    await expect(
      nav.getByRole("link", { name: "Solicitar reserva", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
