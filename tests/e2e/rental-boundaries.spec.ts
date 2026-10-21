import { test, expect } from "@playwright/test";
const id = "f7000000-0000-4000-8000-000000000001";
test("locações e modelos permanecem protegidos sem sessão", async ({
  request,
}) => {
  for (const path of [
    "/admin/locacoes",
    "/admin/locacoes/nova",
    `/admin/locacoes/${id}`,
    "/admin/locacoes/configuracao",
  ]) {
    const r = await request.get(path, {
      maxRedirects: 0,
      headers: { "x-user-role": "ADMIN", cookie: "role=ADMIN" },
    });
    expect(r.status()).toBe(307);
    expect(r.headers().location).toContain("/login");
    expect(r.headers()["cache-control"]).toContain("no-store");
  }
});
test("API de locações recusa sessão e estado de retirada forjados", async ({
  request,
}) => {
  const headers = { "x-user-role": "ADMIN" };
  for (const [method, path] of [
    ["get", "/api/v1/admin/rentals"],
    ["post", "/api/v1/admin/rentals"],
    ["get", `/api/v1/admin/rentals/${id}`],
    ["patch", `/api/v1/admin/rentals/${id}`],
    ["post", `/api/v1/admin/rentals/${id}/extend`],
  ] as const) {
    const r = await request[method](path, {
      headers,
      ...(method === "get"
        ? {}
        : { data: { status: "ACTIVE", skip_contract: true } }),
    });
    expect(r.status()).toBe(503);
    expect(r.headers()["cache-control"]).toContain("no-store");
  }
});
test("worker não opera sem segredo configurado", async ({ request }) => {
  const r = await request.post("/api/internal/rental-jobs", {
    headers: { authorization: "Bearer fake" },
  });
  expect(r.status()).toBe(503);
  expect(r.headers()["cache-control"]).toContain("no-store");
});
