import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import fixture from "../fixtures/pricing.json";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  cookies: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/auth/config", () => ({
  authConfig: () => ({
    secret: "s".repeat(32),
    appUrl: "https://locadora.example",
    secure: true,
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/auth/limits", () => ({ consumeLimit: mocks.limit }));
import {
  readVisitor,
  signVisitor,
  VISITOR_COOKIE,
} from "@/lib/public/security";
import { verifyChallenge } from "@/lib/public/antispam";
import { quotePublic, requestPublic } from "@/lib/public/service";
import { publicInputSchema, publicRequestSchema } from "@/lib/public/schema";
import { localBookingInstant } from "@/lib/public/dates";
const id = fixture.input.rate_plan_id,
  key = "public_key_1234567890",
  secret = "s".repeat(32);
const {
  customer_id: _,
  discount_amount: __,
  discount_reason: ___,
  ...input
} = fixture.input;
void _;
void __;
void ___;
const catalog = {
  fingerprint: "a".repeat(64),
  revision: 1,
  plan: {
    id,
    name: "Teste",
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
  total: "200.00",
  deposit: "500.00",
  expires_at: "2030-01-01T00:00:00Z",
  items: [
    {
      kind: "RENTAL",
      description: "Teste",
      quantity: "2.0000",
      total: "200.00",
    },
  ],
};
const customer = {
  person_type: "PF",
  name: "Cliente teste",
  tax_document: "529.982.247-25",
  email: "TEST@example.invalid",
  phone: "85999999999",
  birth_date: null,
  postal_code: "60000-000",
  street: "Rua teste",
  number: "1",
  district: "Centro",
  city: "Fortaleza",
  state: "CE",
  complement: "",
};
const request = {
  quote_id: id,
  customer,
  terms_version: fixture.input.branch_id,
  accepted: true,
  idempotency_key: key,
  captcha: "challenge",
  website: "",
};
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
  mocks.cookies.mockResolvedValue({
    get: (key: string) =>
      key === VISITOR_COOKIE
        ? { value: signVisitor(secret, id, Date.now() - 3000) }
        : undefined,
  });
  mocks.limit.mockResolvedValue(true);
  mocks.rpc.mockImplementation(async (name) => ({
    data:
      name === "find_public_operation"
        ? null
        : name === "public_pricing_context"
          ? catalog
          : name === "public_quote_owned"
            ? quote
            : name === "public_quote_stock"
              ? 1
              : name === "request_public_reservation"
                ? { id, status: "REQUESTED" }
                : { id },
    error: null,
  }));
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      hostname: "locadora.example",
      action: "quote",
      challenge_ts: new Date().toISOString(),
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("antispam e fronteira pública", () => {
  it("cookie assinado expira, recusa adulteração, futuro e domínio de assinatura incorreto", () => {
    const signed = signVisitor(secret, id, 1000);
    expect(readVisitor(secret, signed, 2000)?.id).toBe(id);
    expect(readVisitor(secret, signed, 999)).toBeNull();
    expect(readVisitor(secret, signed, 86401000)).toBeNull();
    expect(readVisitor("outro", signed, 2000)).toBeNull();
    expect(readVisitor(secret, signed + "x", 2000)).toBeNull();
  });
  it("payload público não aceita total, desconto, cliente existente ou notas internas", () => {
    expect(publicInputSchema.parse(input).discount_amount).toBe("0.00");
    for (const extra of [
      { total: "1.00" },
      { discount_amount: "1.00" },
      { customer_id: id },
    ])
      expect(publicInputSchema.safeParse({ ...input, ...extra }).success).toBe(
        false,
      );
    expect(
      publicRequestSchema.safeParse({
        ...request,
        customer: { ...customer, notes: "interna" },
      }).success,
    ).toBe(false);
    expect(publicRequestSchema.parse(request).customer.tax_document).toBe(
      "52998224725",
    );
    expect(
      publicRequestSchema.safeParse({ ...request, accepted: false }).success,
    ).toBe(false);
  });
  it("interpreta data no fuso do plano e rejeita horário ambíguo/inexistente", () => {
    expect(localBookingInstant("2030-01-01T10:00", "America/Fortaleza")).toBe(
      "2030-01-01T13:00:00Z",
    );
    expect(() =>
      localBookingInstant("2024-11-03T01:30", "America/New_York"),
    ).toThrow();
    expect(() =>
      localBookingInstant("2024-03-10T02:30", "America/New_York"),
    ).toThrow();
  });
  it("Siteverify confere hostname, action e validade sem enviar IP arbitrário", async () => {
    await verifyChallenge("challenge", "quote", key, id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const args = fetchMock.mock.calls[0];
    expect(args[0]).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    const body = JSON.parse(args[1].body);
    expect(body).not.toHaveProperty("remoteip");
    expect(body.idempotency_key).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    );
    for (const patch of [
      { success: false },
      { hostname: "evil.example" },
      { action: "reservation" },
      { challenge_ts: new Date(Date.now() - 301000).toISOString() },
    ]) {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          hostname: "locadora.example",
          action: "quote",
          challenge_ts: new Date().toISOString(),
          ...patch,
        }),
      });
      await expect(
        verifyChallenge("challenge", "quote", key, id),
      ).rejects.toMatchObject({ status: 400 });
    }
  });
  it("provedor ou configuração indisponível falha fechado", async () => {
    fetchMock.mockRejectedValueOnce(new Error());
    await expect(
      verifyChallenge("challenge", "quote", key, id),
    ).rejects.toMatchObject({ status: 503 });
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    await expect(
      quotePublic({ input, captcha: "x", website: "", idempotency_key: key }),
    ).rejects.toMatchObject({ status: 503 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("sessão ausente, envio rápido e honeypot não gravam cotação", async () => {
    mocks.cookies.mockResolvedValueOnce({ get: () => undefined });
    await expect(
      quotePublic({ input, captcha: "x", website: "", idempotency_key: key }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      quotePublic({
        input,
        captcha: "x",
        website: "bot",
        idempotency_key: key,
      }),
    ).rejects.toMatchObject({ status: 400 });
    mocks.cookies.mockResolvedValueOnce({
      get: () => ({ value: signVisitor(secret, id) }),
    });
    await expect(
      quotePublic({ input, captcha: "x", website: "", idempotency_key: key }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("limite distribuído bloqueia antes de Siteverify ou persistência", async () => {
    mocks.limit.mockResolvedValue(false);
    await expect(
      quotePublic({ input, captcha: "x", website: "", idempotency_key: key }),
    ).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("cota com motor real no servidor e retorna só campos públicos", async () => {
    const result = await quotePublic({
      input,
      captcha: "challenge",
      website: "",
      idempotency_key: key,
    });
    expect(result.total).toBe("200.00");
    expect(result.available).toBe(1);
    expect(result).not.toHaveProperty("rules_snapshot");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "persist_public_quote",
      expect.objectContaining({
        calculation: expect.objectContaining({ total: "200.00" }),
        input: expect.objectContaining({
          customer_id: null,
          discount_amount: "0.00",
        }),
      }),
    );
  });
  it("replay próprio não consome novamente o desafio de uso único", async () => {
    mocks.rpc.mockImplementation(async (name) => ({
      data:
        name === "find_public_operation"
          ? { id }
          : name === "public_quote_owned"
            ? quote
            : 1,
      error: null,
    }));
    expect(
      (
        await quotePublic({
          input,
          captcha: "",
          website: "",
          idempotency_key: key,
        })
      ).id,
    ).toBe(id);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("solicitação valida desafio distinto e envia só hash do token, com quotas por documento/e-mail", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        hostname: "locadora.example",
        action: "reservation",
        challenge_ts: new Date().toISOString(),
      }),
    });
    const result = await requestPublic(request);
    expect(result.lookup_token).toHaveLength(43);
    expect(mocks.limit).toHaveBeenCalledWith(
      "public-document",
      expect.stringMatching(/^[a-f0-9]{64}$/),
      3,
    );
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain(
      result.lookup_token,
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "request_public_reservation",
      expect.objectContaining({
        customer_data: expect.objectContaining({ tax_document: "52998224725" }),
        token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });
});
