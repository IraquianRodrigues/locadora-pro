import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
import { deploymentChecks } from "@/config/deployment";
import { parsePublicEnvironment } from "@/config/env";
import { internalAuthorization } from "@/lib/operations/secret";
const env = {
  NEXT_PUBLIC_APP_URL: "https://locadora.test",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  SUPABASE_SERVICE_ROLE_KEY: "private-key",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key",
  TURNSTILE_SECRET_KEY: "challenge-key",
  AUTH_SECRET: "a".repeat(32),
  RENTAL_JOBS_SECRET: "b".repeat(32),
  OPERATIONS_JOBS_SECRET: "c".repeat(32),
  READINESS_SECRET: "d".repeat(32),
  APP_TIMEZONE: "America/Fortaleza",
};
describe("configuração de promoção", () => {
  it("configuração pública recusa credenciais privilegiadas antes de renderizar ou compilar", () => {
    for (const key of [
      " sb_secret_private-key ",
      `fake.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.fake`,
    ])
      expect(() =>
        parsePublicEnvironment({
          ...env,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
        }),
      ).toThrow();
  });
  it("configuração completa sem email opcional passa", () =>
    expect(deploymentChecks(env)).toEqual([]));
  it("HTTPS, chaves privilegiadas no público e segredos compartilhados impedem promoção", () => {
    const result = deploymentChecks({
      ...env,
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_private-key",
      READINESS_SECRET: env.AUTH_SECRET,
    });
    expect(result).toContain("NEXT_PUBLIC_APP_URL:HTTPS_ORIGIN_REQUIRED");
    expect(result).toContain(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:PUBLIC_KEY_REQUIRED",
    );
    expect(result).toContain("SECRETS:MUST_BE_DISTINCT");
    expect(result.join()).not.toContain(env.AUTH_SECRET);
  });
  it("JWT de serviço não pode ser configurado como chave publicável", () => {
    const key = `fake.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.fake`;
    expect(
      deploymentChecks({ ...env, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }),
    ).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:PUBLIC_KEY_REQUIRED");
  });
  it("email parcialmente configurado não passa", () =>
    expect(
      deploymentChecks({ ...env, NOTIFICATION_EMAIL_PROVIDER: "resend" }),
    ).toContain("EMAIL:INCOMPLETE_CONFIGURATION"));
  it("Bearer interno distingue falta de configuração e segredo incorreto", () => {
    expect(internalAuthorization(undefined, null)).toBe(503);
    expect(internalAuthorization(env.READINESS_SECRET, "Bearer fake")).toBe(
      401,
    );
    expect(
      internalAuthorization(
        env.READINESS_SECRET,
        `Bearer ${env.READINESS_SECRET}`,
      ),
    ).toBe(200);
  });
});
const m = vi.hoisted(() => ({ rpc: vi.fn(), checks: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: () => ({ abortSignal: m.rpc }) }),
}));
vi.mock("@/config/env", async (original) => ({
  ...(await original<typeof import("@/config/env")>()),
  requireSupabaseEnvironment: () => ({
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }),
}));
import { GET } from "@/app/api/internal/readiness/route";
import { NextRequest } from "next/server";
beforeEach(() => {
  vi.stubEnv("READINESS_SECRET", env.READINESS_SECRET);
  vi.stubGlobal("fetch", m.fetch);
  m.rpc.mockReset();
  m.fetch.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("readiness não consulta dependências sem segredo correto", async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/internal/readiness"),
  );
  expect(response.status).toBe(401);
  expect(m.rpc).not.toHaveBeenCalled();
});
it("readiness relata somente checks sanitizados e falha fechada", async () => {
  m.rpc.mockResolvedValue({
    data: null,
    error: { message: "sensitive database detail" },
  });
  m.fetch.mockResolvedValue(new Response(null, { status: 503 }));
  const response = await GET(
    new NextRequest("http://localhost/api/internal/readiness", {
      headers: { authorization: `Bearer ${env.READINESS_SECRET}` },
    }),
  );
  expect(response.status).toBe(503);
  const body = await response.text();
  expect(body).not.toContain("sensitive");
  expect(body).not.toContain(env.READINESS_SECRET);
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("readiness só retorna pronto com configuração e todos os checks aprovados", async () => {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  m.rpc.mockResolvedValue({
    data: { schema: true, storage: true, rls: true },
    error: null,
  });
  m.fetch.mockResolvedValue(new Response(null, { status: 200 }));
  const response = await GET(
    new NextRequest("http://localhost/api/internal/readiness", {
      headers: { authorization: `Bearer ${env.READINESS_SECRET}` },
    }),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).status).toBe("ready");
});
