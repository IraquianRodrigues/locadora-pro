import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ guard: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireStaff: mocks.guard }));
import {
  archiveRecord,
  escapeSearch,
  getRecord,
  listRecords,
  saveRecord,
} from "@/lib/registry/service";
import { apiResource, readJson } from "@/lib/registry/api";
import { NextRequest } from "next/server";

const id = "f4000000-0000-4000-8000-000000000001",
  revision = "2026-10-19T15:00:00.123456+00:00";
const input = {
  name: "Categoria",
  description: "",
  capacity: 5,
  features: "Ar",
  active: true,
};
function query() {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    not: vi.fn(),
    ilike: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    maybeSingle: vi.fn(),
  };
  for (const key of [
    "select",
    "eq",
    "is",
    "not",
    "ilike",
    "order",
    "insert",
    "update",
  ] as const)
    q[key].mockReturnValue(q);
  q.range.mockResolvedValue({ data: [], count: 0, error: null });
  q.maybeSingle.mockResolvedValue({ data: { id }, error: null });
  return q;
}
let q: ReturnType<typeof query>;
beforeEach(() => {
  vi.resetAllMocks();
  q = query();
  mocks.from.mockReturnValue(q);
  mocks.guard.mockResolvedValue({
    client: { from: mocks.from },
    staff: { permissions: ["categories.read", "categories.write"] },
  });
});
describe("CRUD no servidor com adapter isolado", () => {
  it("verifica permissão antes de acessar tabelas", async () => {
    mocks.guard.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(saveRecord("categorias", input)).rejects.toThrow("FORBIDDEN");
    expect(mocks.guard).toHaveBeenCalledWith("categories.write");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("valida dados e não admite metadados internos ou mass assignment", async () => {
    await expect(
      saveRecord("categorias", { ...input, id, archived_at: revision }),
    ).rejects.toThrow();
    expect(mocks.from).not.toHaveBeenCalled();
    await saveRecord("categorias", input);
    expect(q.insert).toHaveBeenCalledWith({ ...input, features: ["Ar"] });
  });
  it("edição exige revisão exata e cadastro não arquivado", async () => {
    await saveRecord("categorias", input, id, revision);
    expect(q.eq).toHaveBeenCalledWith("updated_at", revision);
    expect(q.is).toHaveBeenCalledWith("archived_at", null);
    q.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(
      saveRecord("categorias", input, id, revision),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });
  it("duplicidade e integridade são apresentadas sem SQL ou dados privados", async () => {
    q.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "CPF 52998224725 SQL SECRET" },
    });
    try {
      await saveRecord("categorias", input);
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toMatchObject({ status: 409, code: "CONFLICT" });
      expect((error as Error).message).not.toContain("52998224725");
    }
  });
  it("arquiva e restaura sem DELETE e exige revisão", async () => {
    await archiveRecord("categorias", id, revision, true);
    expect(q.update).toHaveBeenCalledWith({ archived_at: expect.any(String) });
    expect(q.eq).toHaveBeenCalledWith("updated_at", revision);
    await archiveRecord("categorias", id, revision, false);
    expect(q.update).toHaveBeenLastCalledWith({ archived_at: null });
    expect(q.not).toHaveBeenCalledWith("archived_at", "is", null);
  });
  it("lista paginada escapa curingas e ordena com desempate por ID", async () => {
    expect(escapeSearch("100%_\\")).toBe("100\\%\\_\\\\");
    await listRecords("clientes", { q: "Nome%_", page: 2 });
    expect(mocks.guard).toHaveBeenCalledWith("customers.read");
    expect(q.ilike).toHaveBeenCalledWith("name", "%Nome\\%\\_%");
    expect(q.range).toHaveBeenCalledWith(20, 39);
    expect(q.order).toHaveBeenCalledWith("id");
  });
  it("registro ausente retorna 404", async () => {
    q.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(getRecord("clientes", id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("API usa allowlist de recursos e limita JSON pelos bytes recebidos", async () => {
    expect(apiResource("vehicles")).toBe("frota");
    expect(() => apiResource("__proto__")).toThrow();
    expect(
      await readJson(
        new NextRequest("https://app.invalid/api", {
          method: "POST",
          body: '{"name":"Teste"}',
        }),
      ),
    ).toEqual({ name: "Teste" });
    await expect(
      readJson(
        new NextRequest("https://app.invalid/api", {
          method: "POST",
          body: "{",
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      readJson(
        new NextRequest("https://app.invalid/api", {
          method: "POST",
          body: "x".repeat(65537),
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
});
