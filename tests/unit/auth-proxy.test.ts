import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  configured: true,
  staff: vi.fn(),
  getUser: vi.fn(),
  setAll: undefined as
    | undefined
    | ((
        cookies: { name: string; value: string; options: CookieOptions }[],
        headers: Record<string, string>,
      ) => void),
}));
vi.mock("@/config/env", () => ({
  requireSupabaseEnvironment: () => ({
    url: "https://example.supabase.co",
    key: "public",
  }),
}));
vi.mock("@/lib/auth/config", () => ({
  authConfigured: () => mocks.configured,
  authConfig: () => ({ secure: true }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: unknown,
    _key: unknown,
    options: { cookies: { setAll: typeof mocks.setAll } },
  ) => {
    mocks.setAll = options.cookies.setAll;
    return { auth: { getUser: mocks.getUser } };
  },
}));
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return { ...actual, verifiedStaff: mocks.staff };
});
import { proxy } from "@/proxy";
import { AccessError } from "@/lib/auth/session";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured = true;
  mocks.staff.mockResolvedValue({ permissions: ["operations.read"] });
});
describe("proxy SSR", () => {
  it("preserva cookies de refresh na resposta de redirecionamento", async () => {
    mocks.staff.mockImplementation(async () => {
      mocks.setAll?.(
        [
          {
            name: "sb-test-auth-token",
            value: "renewed",
            options: {
              httpOnly: true,
              secure: true,
              sameSite: "lax",
              path: "/",
            },
          },
        ],
        { "Cache-Control": "private, no-store" },
      );
      throw new AccessError(401);
    });
    const result = await proxy(
      new NextRequest("https://locadora.example/admin/dashboard"),
    );
    expect(result.status).toBe(307);
    expect(result.cookies.get("sb-test-auth-token")?.value).toBe("renewed");
    expect(result.headers.get("set-cookie")).toContain("HttpOnly");
    expect(result.headers.get("cache-control")).toContain("no-store");
    expect(
      new URL(result.headers.get("location")!).searchParams.get("next"),
    ).toBe("/admin/dashboard");
  });
  it("autenticado sem permissão recebe 403 antes do streaming", async () => {
    const result = await proxy(
      new NextRequest("https://locadora.example/admin/financeiro"),
    );
    expect(result.status).toBe(403);
    expect(result.headers.get("x-middleware-rewrite")).toBe(
      "https://locadora.example/acesso-negado",
    );
  });
  it("API retorna 401, 403 ou 503 sem redirecionar", async () => {
    for (const status of [401, 403, 503] as const) {
      mocks.staff.mockRejectedValue(new AccessError(status));
      const result = await proxy(
        new NextRequest("https://locadora.example/api/v1/admin/session"),
      );
      expect(result.status).toBe(status);
      expect(result.headers.get("location")).toBeNull();
    }
  });
  it("sem configuração falha fechada", async () => {
    mocks.configured = false;
    const result = await proxy(
      new NextRequest("https://locadora.example/api/v1/admin/session"),
    );
    expect(result.status).toBe(503);
    expect(mocks.staff).not.toHaveBeenCalled();
  });
  it("renova cookies também nas telas de login e recuperação", async () => {
    await proxy(new NextRequest("https://locadora.example/login"));
    expect(mocks.getUser).toHaveBeenCalledOnce();
  });
});
