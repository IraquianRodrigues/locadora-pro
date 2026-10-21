import { expect, test } from "@playwright/test";

test("cadastros e detalhes não abrem com sessão ausente ou cargo forjado", async ({
  request,
}) => {
  for (const resource of [
    "categorias",
    "frota",
    "clientes",
    "condutores",
    "unidades",
    "planos",
    "precos",
    "adicionais",
  ]) {
    for (const suffix of [
      "",
      "/novo",
      "/f4000000-0000-4000-8000-000000000001",
    ]) {
      const result = await request.get(`/admin/${resource}${suffix}`, {
        maxRedirects: 0,
        headers: { cookie: "role=ADMIN", "x-user-role": "ADMIN" },
      });
      expect(result.status()).toBe(307);
      expect(
        new URL(result.headers().location, "http://127.0.0.1:3100").pathname,
      ).toBe("/login");
      expect(result.headers()["cache-control"]).toContain("no-store");
    }
  }
});
test("API de CRUD exige Auth inclusive para mutações diretas", async ({
  request,
}) => {
  for (const resource of [
    "categories",
    "vehicles",
    "customers",
    "drivers",
    "branches",
  ]) {
    const url = `/api/v1/admin/${resource}`;
    const results = [
      await request.get(url),
      await request.post(url, { data: { role: "ADMIN" } }),
      await request.patch(`${url}/f4000000-0000-4000-8000-000000000001`, {
        data: { values: { archived_at: null } },
      }),
      await request.delete(`${url}/f4000000-0000-4000-8000-000000000001`, {
        data: { revision: "forged" },
      }),
    ];
    for (const result of results) {
      expect(result.status()).toBe(503);
      expect((await result.json()).error.code).toBe("AUTH_UNAVAILABLE");
      expect(result.headers()["cache-control"]).toContain("no-store");
    }
  }
});
