import { expect, test } from "@playwright/test";

test("API administrativa falha fechada sem configuração e não expõe dados", async ({
  request,
}) => {
  const result = await request.get("/api/v1/admin/session");
  expect(result.status()).toBe(503);
  expect(await result.json()).toMatchObject({
    error: { code: "AUTH_UNAVAILABLE", requestId: expect.any(String) },
  });
  expect(result.headers()["cache-control"]).toContain("no-store");
});
test("cookies inventados e URLs externas não liberam o painel", async ({
  request,
}) => {
  const result = await request.get("/admin/dashboard", {
    maxRedirects: 0,
    headers: {
      cookie: "role=ADMIN; lp-recovery=forged; sb-fake-auth-token=fake",
      "x-user-role": "ADMIN",
    },
  });
  expect(result.status()).toBe(307);
  const callback = await request.get(
    "/auth/callback?code=falso&next=https://example.invalid",
    { maxRedirects: 0 },
  );
  expect(new URL(callback.headers().location).pathname).toBe("/login");
  expect(callback.headers()["referrer-policy"]).toBe("no-referrer");
});
test("recuperação não aceita token inválido nem sessão ausente", async ({
  page,
  request,
}) => {
  await page.goto("/auth/confirm?token_hash=forjado&type=recovery");
  await expect(
    page.getByRole("alert").filter({ hasText: "Link inválido" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continuar recuperação" }),
  ).toHaveCount(0);
  await page.goto("/recuperar-senha");
  await expect(page.getByLabel("E-mail")).toBeDisabled();
  const result = await request.get("/atualizar-senha", { maxRedirects: 0 });
  // Server Component pode enviar redirect por streaming; em ambos os casos nunca mostra formulário.
  if (result.status() === 200)
    expect(await result.text()).not.toContain('id="confirmation"');
  else expect(result.status()).toBe(307);
});
