import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  origin: "https://locadora.example",
  store: { get: vi.fn(), getAll: vi.fn(), set: vi.fn(), delete: vi.fn() },
  client: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
      updateUser: vi.fn(),
    },
    rpc: vi.fn(),
  },
  staff: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: mocks.origin }),
  cookies: async () => mocks.store,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mocks.client,
}));
vi.mock("@/config/env", () => ({
  requireSupabaseEnvironment: () => ({
    url: "https://test.supabase.co",
    key: "public",
  }),
}));
vi.mock("@/lib/auth/config", () => ({
  authConfig: () => ({
    secret: "s".repeat(32),
    appUrl: "https://locadora.example",
    secure: true,
  }),
}));
vi.mock("@/lib/auth/session", () => ({ verifiedStaff: mocks.staff }));
vi.mock("@/lib/auth/limits", () => ({ consumeLimit: mocks.limit }));
import {
  confirmRecoveryAction,
  loginAction,
  logoutAction,
  requestRecoveryAction,
  updatePasswordAction,
  setStaffAccessAction,
} from "@/lib/auth/actions";
import { signRecovery, RECOVERY_COOKIE } from "@/lib/auth/security";

const staff = {
  id: "f3000000-0000-4000-8000-000000000001",
  sessionId: "f3000000-0000-4000-8000-000000000002",
};
const credentials = {
  email: "staff@example.invalid",
  password: "SenhaForte123!",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.origin = "https://locadora.example";
  mocks.limit.mockResolvedValue(true);
  mocks.staff.mockResolvedValue(staff);
  for (const fn of Object.values(mocks.client.auth))
    fn.mockResolvedValue({ error: null });
  mocks.client.rpc.mockResolvedValue({ error: null });
  mocks.store.getAll.mockReturnValue([]);
});
describe("ações Auth (adapters simulados somente nos testes)", () => {
  it("login só redireciona após identidade, cargo e auditoria", async () => {
    await expect(loginAction(credentials, "//evil.invalid")).rejects.toThrow(
      "REDIRECT:/admin/dashboard",
    );
    expect(mocks.staff).toHaveBeenCalled();
    expect(mocks.client.rpc).toHaveBeenCalledWith("record_auth_event", {
      event_code: "LOGIN",
    });
  });
  it("nega CSRF e excesso antes de autenticar", async () => {
    mocks.origin = "https://evil.invalid";
    expect((await loginAction(credentials)).ok).toBe(false);
    expect(mocks.client.auth.signInWithPassword).not.toHaveBeenCalled();
    mocks.origin = "https://locadora.example";
    mocks.limit.mockResolvedValue(false);
    expect((await loginAction(credentials)).ok).toBe(false);
    expect(mocks.client.auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it("credencial errada e perfil não liberado têm resposta igual e removem sessão negada", async () => {
    mocks.client.auth.signInWithPassword.mockResolvedValueOnce({
      error: { message: "invalid" },
    });
    const invalid = await loginAction(credentials);
    mocks.staff.mockRejectedValueOnce(new Error("inactive"));
    expect(await loginAction(credentials)).toEqual(invalid);
    expect(mocks.client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("falha do limitador nunca libera login", async () => {
    mocks.limit.mockRejectedValue(new Error("offline"));
    expect((await loginAction(credentials)).ok).toBe(false);
    expect(mocks.client.auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it("remove cookies de um login recusado mesmo se logout remoto falhar", async () => {
    mocks.staff.mockRejectedValue(new Error("revoked"));
    mocks.client.auth.signOut.mockResolvedValue({
      error: { message: "offline" },
    });
    mocks.store.getAll.mockReturnValue([
      { name: "sb-test-auth-token.0" },
      { name: "sb-other-auth-token" },
    ]);
    expect((await loginAction(credentials)).ok).toBe(false);
    expect(mocks.store.delete).toHaveBeenCalledWith("sb-test-auth-token.0");
    expect(mocks.store.delete).not.toHaveBeenCalledWith("sb-other-auth-token");
  });
  it("recuperação não enumera e usa destino fixo", async () => {
    const accepted = await requestRecoveryAction({ email: credentials.email });
    expect(mocks.client.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      credentials.email,
      { redirectTo: "https://locadora.example/auth/confirm" },
    );
    mocks.client.auth.resetPasswordForEmail.mockResolvedValue({
      error: { message: "not found" },
    });
    expect(
      await requestRecoveryAction({ email: "missing@example.invalid" }),
    ).toEqual(accepted);
    mocks.limit.mockResolvedValue(false);
    expect(await requestRecoveryAction({ email: credentials.email })).toEqual(
      accepted,
    );
    expect(await requestRecoveryAction({ email: "invalid" })).toEqual(accepted);
  });
  it("link válido exige OTP de recovery e emite cookie protegido", async () => {
    const form = new FormData();
    form.set("token_hash", "a".repeat(64));
    await expect(confirmRecoveryAction(form)).rejects.toThrow(
      "REDIRECT:/atualizar-senha",
    );
    expect(mocks.client.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "a".repeat(64),
      type: "recovery",
    });
    expect(mocks.store.set).toHaveBeenCalledWith(
      RECOVERY_COOKIE,
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 600,
      }),
    );
  });
  it("link inválido/reusado não emite autorização", async () => {
    mocks.client.auth.verifyOtp.mockResolvedValue({
      error: { message: "expired" },
    });
    const form = new FormData();
    form.set("token_hash", "a".repeat(64));
    await expect(confirmRecoveryAction(form)).rejects.toThrow(
      "REDIRECT:/recuperar-senha?link=invalido",
    );
    expect(mocks.store.set).not.toHaveBeenCalled();
  });
  it("sessão normal ou autorização de outra sessão não muda senha", async () => {
    const input = {
      password: credentials.password,
      confirmation: credentials.password,
    };
    expect((await updatePasswordAction(input)).ok).toBe(false);
    mocks.store.get.mockReturnValue({
      value: signRecovery("s".repeat(32), staff.id, staff.id),
    });
    expect((await updatePasswordAction(input)).ok).toBe(false);
    expect(mocks.client.auth.updateUser).not.toHaveBeenCalled();
  });
  it("atualiza com autorização válida, consome cookie e encerra todas as sessões", async () => {
    mocks.store.get.mockReturnValue({
      value: signRecovery("s".repeat(32), staff.id, staff.sessionId),
    });
    await expect(
      updatePasswordAction({
        password: credentials.password,
        confirmation: credentials.password,
      }),
    ).rejects.toThrow("REDIRECT:/login?senha=atualizada");
    expect(mocks.store.delete).toHaveBeenCalledWith(RECOVERY_COOKIE);
    expect(mocks.client.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
  it("logout usa escopo local e não é impedido por auditoria indisponível", async () => {
    mocks.client.rpc.mockResolvedValue({ error: { message: "unavailable" } });
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login?saida=ok");
    expect(mocks.client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("informa salvamento parcial quando encerramento global lança exceção", async () => {
    mocks.store.get.mockReturnValue({
      value: signRecovery("s".repeat(32), staff.id, staff.sessionId),
    });
    mocks.client.auth.signOut.mockRejectedValue(new Error("offline"));
    expect(
      await updatePasswordAction({
        password: credentials.password,
        confirmation: credentials.password,
      }),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining("Senha atualizada."),
    });
    expect(mocks.store.delete).toHaveBeenCalledWith(RECOVERY_COOKIE);
  });
  it("logout com falha não anuncia encerramento confirmado", async () => {
    mocks.client.auth.signOut.mockResolvedValue({
      error: { message: "unavailable" },
    });
    await expect(logoutAction()).rejects.toThrow(
      "REDIRECT:/login?saida=falhou",
    );
  });
  it("auditoria que lança exceção não bloqueia logout", async () => {
    mocks.client.rpc.mockRejectedValue(new Error("network"));
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login?saida=ok");
    expect(mocks.client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("autorização expirada e usuário revogado não alteram senha", async () => {
    const input = {
      password: credentials.password,
      confirmation: credentials.password,
    };
    mocks.store.get.mockReturnValue({
      value: signRecovery(
        "s".repeat(32),
        staff.id,
        staff.sessionId,
        Date.now() - 600001,
      ),
    });
    expect((await updatePasswordAction(input)).ok).toBe(false);
    mocks.staff.mockRejectedValue(new Error("revoked"));
    expect((await updatePasswordAction(input)).ok).toBe(false);
    expect(mocks.client.auth.updateUser).not.toHaveBeenCalled();
  });
  it("ação de gestão repete RBAC mesmo sem passar pela UI", async () => {
    const form = new FormData();
    form.set("user_id", staff.id);
    form.set("role_code", "ADMIN");
    form.set("active", "on");
    mocks.staff.mockResolvedValue({
      ...staff,
      permissions: ["operations.read"],
    });
    await expect(setStaffAccessAction(form)).rejects.toThrow(
      "REDIRECT:/admin/usuarios?resultado=erro",
    );
    expect(mocks.client.rpc).not.toHaveBeenCalled();
    mocks.staff.mockResolvedValue({ ...staff, permissions: ["users.manage"] });
    await expect(setStaffAccessAction(form)).rejects.toThrow(
      "REDIRECT:/admin/usuarios?resultado=ok",
    );
    expect(mocks.client.rpc).toHaveBeenCalledWith("set_staff_access", {
      user_id: staff.id,
      active: true,
      role_code: "ADMIN",
    });
  });
});
