import { test, expect } from "@playwright/test";
const maintenanceId = "f8000000-0000-4000-8000-000000000001";
test("financeiro, manutenção, relatórios e notificações exigem sessão", async ({
  request,
}) => {
  for (const path of [
    "/admin/financeiro",
    "/admin/financeiro/configuracao",
    "/admin/manutencao",
    "/admin/manutencao/nova",
    `/admin/manutencao/${maintenanceId}`,
    "/admin/relatorios",
    "/admin/notificacoes",
    "/admin/notificacoes/configuracao",
    "/admin/usuarios",
    "/admin/site",
  ]) {
    const result = await request.get(path, {
      maxRedirects: 0,
      headers: { "x-user-role": "ADMIN", cookie: "role=ADMIN" },
    });
    expect(result.status()).toBe(307);
    expect(result.headers().location).toContain("/login");
    expect(result.headers()["cache-control"]).toContain("no-store");
  }
});
test("APIs de negócio e exportação não aceitam cargo forjado", async ({
  request,
}) => {
  for (const path of [
    "finance",
    "maintenance",
    `maintenance/${maintenanceId}`,
    "dashboard",
    "reports",
    "reports/export",
  ]) {
    const result = await request.get(`/api/v1/admin/${path}`, {
      headers: { "x-user-role": "ADMIN" },
    });
    expect(result.status()).toBe(503);
    expect(result.headers()["cache-control"]).toContain("no-store");
  }
  for (const path of ["finance", "maintenance"])
    expect(
      (
        await request.post(`/api/v1/admin/${path}`, {
          data: { action: "PAYMENT", received: true },
          headers: { "x-user-role": "ADMIN" },
        })
      ).status(),
    ).toBe(503);
  expect(
    (
      await request.patch(`/api/v1/admin/maintenance/${maintenanceId}`, {
        data: { action: "COMPLETE", skip_conflicts: true },
        headers: { "x-user-role": "ADMIN" },
      })
    ).status(),
  ).toBe(503);
});
test("worker de negócio permanece fechado sem segredo", async ({ request }) => {
  const result = await request.post("/api/internal/business-jobs", {
    headers: { authorization: "Bearer fake" },
  });
  expect(result.status()).toBe(503);
  expect(result.headers()["cache-control"]).toContain("no-store");
});
