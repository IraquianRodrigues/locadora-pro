import { test, expect } from "@playwright/test";
test("tarifas, cotações e reservas mantêm painel fechado sem sessão", async ({
  request,
}) => {
  for (const url of [
    "/admin/planos",
    "/admin/precos/novo",
    "/admin/adicionais",
    "/admin/reservas",
    "/admin/reservas/nova",
    "/admin/reservas/f5000000-0000-4000-8000-000000000001",
  ]) {
    const r = await request.get(url, {
      maxRedirects: 0,
      headers: { "x-user-role": "ADMIN", cookie: "role=ADMIN" },
    });
    expect(r.status()).toBe(307);
    expect(
      new URL(r.headers().location, "http://127.0.0.1:3100").pathname,
    ).toBe("/login");
    expect(r.headers()["cache-control"]).toContain("no-store");
  }
});
test("mutações de reserva e preço não aceitam cargo ou totais forjados", async ({
  request,
}) => {
  for (const url of [
    "/api/v1/admin/rate-plans",
    "/api/v1/admin/prices",
    "/api/v1/admin/services",
    "/api/v1/admin/quotes",
    "/api/v1/admin/availability",
    "/api/v1/admin/reservations",
    "/api/v1/admin/reservations/expire",
  ]) {
    const r = await request.post(url, {
      data: { role: "ADMIN", total: "0.01" },
    });
    expect(r.status()).toBe(503);
    expect((await r.json()).error.code).toBe("AUTH_UNAVAILABLE");
  }
  const r = await request.patch(
    "/api/v1/admin/reservations/f5000000-0000-4000-8000-000000000001",
    { data: { target: "CONFIRMED", expected_version: 1 } },
  );
  expect(r.status()).toBe(503);
});
test("status público fica indisponível sem Supabase e não é cacheável", async ({
  request,
}) => {
  const r = await request.get(
    "/api/v1/public/reservations/f5000000-0000-4000-8000-000000000001/status",
    { headers: { "X-Reservation-Token": "a".repeat(43) } },
  );
  expect(r.status()).toBe(503);
  expect((await r.json()).error.code).toBe("SERVICE_UNAVAILABLE");
  expect(r.headers()["cache-control"]).toContain("no-store");
});
