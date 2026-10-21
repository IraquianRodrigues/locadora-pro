import { beforeEach, describe, it, expect, vi } from "vitest";
import fixture from "../fixtures/pricing.json";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  rpc: vi.fn(),
  admin: vi.fn(),
  from: vi.fn(),
  limit: vi.fn(),
  configured: vi.fn(),
}));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  requireStaff: mocks.guard,
}));
vi.mock("@/lib/auth/config", () => ({
  authConfig: () => ({ secret: "s".repeat(32) }),
  authConfigured: mocks.configured,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.admin }),
}));
vi.mock("@/lib/auth/limits", () => ({ consumeLimit: mocks.limit }));
import {
  createQuote,
  requestReservation,
  decideReservation,
  expireReservations,
  getReservation,
} from "@/lib/reservations/service";
import { GET } from "@/app/api/v1/public/reservations/[id]/status/route";
import { NextRequest } from "next/server";
import { tokenHash } from "@/lib/reservations/token";
const id = fixture.input.rate_plan_id,
  key = "key_test_1234567890",
  actor = "f5000000-0000-4000-8000-000000000011",
  session = "f5000000-0000-4000-8000-000000000012";
const catalog = {
  fingerprint: "a".repeat(64),
  revision: 1,
  plan: {
    id,
    name: "Apenas teste",
    version: 1,
    period_unit: "DAY",
    month_mode: null,
    commercial_month_days: null,
    policy: fixture.policy,
  },
  price: { id: fixture.input.branch_id, amount: "100.00", scope: "CATEGORY" },
  addons: [],
};
const quote = {
  id,
  total: 200,
  deposit: 500,
  expires_at: "2030-01-01T12:00:00Z",
  rules_snapshot: {},
  quote_items: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.limit.mockResolvedValue(true);
  mocks.guard.mockResolvedValue({
    client: { rpc: mocks.rpc, from: mocks.from },
    staff: {
      id: actor,
      sessionId: session,
      roles: ["ATTENDANT"],
      permissions: [
        "pricing.read",
        "reservations.read",
        "reservations.request",
        "vehicles.read",
      ],
    },
  });
  const q = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  q.maybeSingle.mockResolvedValue({ data: quote, error: null });
  mocks.from.mockReturnValue(q);
  mocks.rpc.mockImplementation(async (name) => ({
    data:
      name === "find_staff_quote_operation"
        ? null
        : name === "staff_pricing_context"
          ? catalog
          : { id, status: "REQUESTED" },
    error: null,
  }));
  mocks.admin.mockResolvedValue({ data: { id }, error: null });
});
describe("fronteiras de cotações e reservas no servidor", () => {
  it("normaliza relação única do PostgREST sem devolver campos privados de token", async () => {
    const query = mocks.from();
    query.maybeSingle.mockResolvedValueOnce({
      data: {
        id,
        customer_id: actor,
        branch_id: fixture.input.branch_id,
        quote_id: id,
        status: "REQUESTED",
        start_at: fixture.input.start_at,
        end_at: fixture.input.end_at,
        expires_at: "2030-01-01T00:00:00Z",
        version: 1,
        reservation_items: {
          category_id: fixture.input.category_id,
          vehicle_id: null,
        },
        reservation_locations: [],
        reservation_status_history: [],
        vehicle_allocations: [],
        lookup_token_hash: "private",
      },
      error: null,
    });
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await getReservation(id);
    expect(result.reservation_items).toEqual([
      { category_id: fixture.input.category_id, vehicle_id: null },
    ]);
    expect(result).not.toHaveProperty("lookup_token_hash");
  });
  it("não consulta serviço privilegiado antes de verificar sessão, RBAC e payload", async () => {
    mocks.guard.mockRejectedValueOnce(new Error("UNAUTHORIZED"));
    await expect(createQuote(fixture.input, key)).rejects.toThrow(
      "UNAUTHORIZED",
    );
    expect(mocks.admin).not.toHaveBeenCalled();
    await expect(
      createQuote({ ...fixture.input, total: "0.01" }, key),
    ).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("calcula no servidor e transmite ator, sessão e fingerprint verificados", async () => {
    const result = await createQuote(fixture.input, key);
    expect(result.total).toBe("200.00");
    expect(result.deposit).toBe("500.00");
    expect(mocks.admin).toHaveBeenCalledWith(
      "persist_staff_quote",
      expect.objectContaining({
        actor_id: actor,
        session_id: session,
        expected_fingerprint: catalog.fingerprint,
        calculation: expect.objectContaining({
          total: "200.00",
          deposit: "500.00",
        }),
      }),
    );
  });
  it("replay recupera snapshot anterior sem exigir tarifa ainda vigente", async () => {
    mocks.rpc.mockResolvedValue({ data: { id }, error: null });
    await createQuote(fixture.input, key);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("desconto sem permissão falha antes da persistência privilegiada", async () => {
    await expect(
      createQuote(
        {
          ...fixture.input,
          discount_amount: "1.00",
          discount_reason: "Motivo teste",
        },
        key,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("erro de concorrência é sanitizado, sem SQL ou dados internos", async () => {
    mocks.admin.mockResolvedValue({
      data: null,
      error: { code: "40001", message: "SQL SECRET" },
    });
    await expect(createQuote(fixture.input, key)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("solicitação envia somente hash; repetição devolve o mesmo token", async () => {
    const input = {
      quote_id: id,
      customer_id: fixture.input.branch_id,
      idempotency_key: key,
    };
    const first = await requestReservation(input),
      second = await requestReservation(input);
    expect(first).toEqual(second);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "request_staff_reservation",
      expect.objectContaining({ token_hash: tokenHash(first.lookup_token) }),
    );
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain(
      first.lookup_token,
    );
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("decisão de aprovação exige permissão antes da RPC e expiração usa escopo específico", async () => {
    await expect(
      decideReservation(id, {
        expected_version: 1,
        target: "CONFIRMED",
        reason: "Motivo teste",
        idempotency_key: key,
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.admin.mockResolvedValue({ data: 3, error: null });
    expect(await expireReservations()).toBe(3);
    expect(mocks.guard).toHaveBeenLastCalledWith("reservations.approve");
    expect(mocks.admin).toHaveBeenCalledWith("expire_pending_reservations", {
      batch_size: 100,
    });
  });
});
describe("consulta mínima por token", () => {
  const status = (token?: string, suffix = "", target = id) =>
    GET(
      new NextRequest(
        `https://app.invalid/api/v1/public/reservations/${target}/status${suffix}`,
        { headers: token ? { "X-Reservation-Token": token } : {} },
      ),
      { params: Promise.resolve({ id: target }) },
    );
  it("não aceita token em URL e retorna a mesma ausência para ID/token inválido ou expirado", async () => {
    expect((await status(undefined, "?token=" + "a".repeat(43))).status).toBe(
      404,
    );
    expect(mocks.admin).not.toHaveBeenCalled();
    mocks.admin.mockResolvedValue({ data: null, error: null });
    const missing = await status("a".repeat(43));
    const invalid = await status("x");
    const invalidId = await status("a".repeat(43), "", "invalid");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual(await invalid.json());
    expect(await invalidId.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Reserva não encontrada ou consulta expirada.",
      },
    });
  });
  it("resposta allowlist omite PII, aplica no-store e consome limite por hash", async () => {
    mocks.admin.mockResolvedValue({
      data: {
        id,
        status: "REQUESTED",
        updated_at: "2030-01-01",
        customer_id: "private",
        lookup_token_hash: "secret",
      },
      error: null,
    });
    const result = await status("a".repeat(43));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({
      data: { id, status: "REQUESTED", updated_at: "2030-01-01" },
    });
    expect(result.headers.get("cache-control")).toContain("no-store");
    expect(mocks.limit).toHaveBeenCalledWith(
      "reservation-status",
      tokenHash("a".repeat(43)),
      30,
    );
  });
  it("limite excedido e indisponibilidade falham fechados", async () => {
    mocks.limit.mockResolvedValueOnce(false);
    expect((await status("a".repeat(43))).status).toBe(429);
    expect(mocks.admin).not.toHaveBeenCalled();
    mocks.limit.mockRejectedValueOnce(new Error("LIMIT_DOWN"));
    expect((await status("a".repeat(43))).status).toBe(503);
    expect(mocks.admin).not.toHaveBeenCalled();
    mocks.configured.mockReturnValue(false);
    expect((await status("a".repeat(43))).status).toBe(503);
  });
});
