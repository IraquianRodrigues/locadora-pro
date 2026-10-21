import { beforeEach, describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authConfigured: () => true }));
import { AccessError, requireStaff, verifiedStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const staff = {
  id: "f3000000-0000-4000-8000-000000000001",
  sessionId: "f3000000-0000-4000-8000-000000000002",
  displayName: "Equipe",
  roles: ["ATTENDANT"],
  permissions: ["operations.read"],
};
const client = { auth: { getUser: vi.fn() }, rpc: vi.fn() };
beforeEach(() => {
  vi.resetAllMocks();
  client.auth.getUser.mockResolvedValue({
    data: { user: { id: staff.id } },
    error: null,
  });
  client.rpc.mockResolvedValue({ data: staff, error: null });
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as SupabaseClient,
  );
});
describe("autorização no servidor", () => {
  it("valida identidade antes de consultar RBAC", async () => {
    client.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid" },
    });
    await expect(
      verifiedStaff(client as unknown as SupabaseClient),
    ).rejects.toMatchObject({ status: 401 });
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("nega perfil inativo/sem cargo e identidade divergente", async () => {
    for (const value of [
      null,
      { ...staff, id: staff.sessionId },
      { ...staff, roles: [] },
    ]) {
      client.rpc.mockResolvedValue({ data: value, error: null });
      await expect(requireStaff()).rejects.toMatchObject({ status: 403 });
    }
  });
  it("falha fechada se banco não responde", async () => {
    client.rpc.mockResolvedValue({
      data: null,
      error: { message: "unavailable" },
    });
    await expect(requireStaff()).rejects.toMatchObject({ status: 503 });
  });
  it("não confia em metadata do usuário para permissões", async () => {
    client.auth.getUser.mockResolvedValue({
      data: { user: { id: staff.id, user_metadata: { role: "ADMIN" } } },
      error: null,
    });
    await expect(requireStaff("users.manage")).rejects.toBeInstanceOf(
      AccessError,
    );
    expect((await requireStaff()).staff.permissions).toEqual([
      "operations.read",
    ]);
  });
});
