import { test, expect } from "@playwright/test";
test("política de conteúdo protege objetos, formulários e frames", async ({
  request,
}) => {
  const r = await request.get("/login");
  const csp = r.headers()["content-security-policy"];
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("form-action 'self'");
});
test("readiness privada falha fechada e não revela configuração", async ({
  request,
}) => {
  const r = await request.get("/api/internal/readiness");
  expect(r.status()).toBe(503);
  expect(await r.json()).toEqual({ status: "unavailable" });
  expect(r.headers()["cache-control"]).toContain("no-store");
  expect((await request.post("/api/internal/readiness")).status()).toBe(405);
});
