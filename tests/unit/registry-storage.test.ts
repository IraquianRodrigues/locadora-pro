import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  verified: vi.fn(),
  admin: vi.fn(),
  prepare: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  requireStaff: mocks.guard,
  verifiedStaff: mocks.verified,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/auth/limits", () => ({ consumeLimit: mocks.limit }));
vi.mock("@/lib/registry/file-content", () => ({ prepareFile: mocks.prepare }));
import { signRegistryFile, uploadRegistryFile } from "@/lib/registry/files";

const id = "f4000000-0000-4000-8000-000000000001";
const ownerQuery = {
  select: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  maybeSingle: vi.fn(),
};
const updateQuery = { eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() };
const storage = { upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn() };
const table = { insert: vi.fn(), update: vi.fn(), select: vi.fn() };
const currentQuery = { eq: vi.fn(), maybeSingle: vi.fn() };
const admin = { from: vi.fn(), storage: { from: vi.fn() } };
beforeEach(() => {
  vi.resetAllMocks();
  for (const key of ["select", "eq", "is"] as const)
    ownerQuery[key].mockReturnValue(ownerQuery);
  ownerQuery.maybeSingle.mockResolvedValue({ data: { id }, error: null });
  for (const key of ["eq", "select"] as const)
    updateQuery[key].mockReturnValue(updateQuery);
  updateQuery.maybeSingle.mockResolvedValue({ data: { id }, error: null });
  table.insert.mockResolvedValue({ error: null });
  table.update.mockReturnValue(updateQuery);
  table.select.mockReturnValue(currentQuery);
  currentQuery.eq.mockReturnValue(currentQuery);
  currentQuery.maybeSingle.mockResolvedValue({
    data: { status: "PENDING" },
    error: null,
  });
  admin.from.mockReturnValue(table);
  admin.storage.from.mockReturnValue(storage);
  storage.upload.mockResolvedValue({ error: null });
  storage.remove.mockResolvedValue({ error: null });
  storage.createSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://example.supabase.co/signed" },
    error: null,
  });
  mocks.admin.mockReturnValue(admin);
  mocks.limit.mockResolvedValue(true);
  const staff = { id, permissions: ["vehicles.read", "vehicles.write"] };
  mocks.guard.mockResolvedValue({
    client: { from: () => ownerQuery, storage: { from: () => storage } },
    staff,
  });
  mocks.verified.mockResolvedValue(staff);
  mocks.prepare.mockResolvedValue({
    body: Buffer.from("jpeg"),
    mediaType: "image/jpeg",
    extension: "jpg",
    size: 4,
    sha256: "a".repeat(64),
  });
});
describe("pipeline Storage (SDK simulado só no teste)", () => {
  it("resposta perdida após READY não apaga o objeto já publicado", async () => {
    updateQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "TIMEOUT" },
    });
    currentQuery.maybeSingle.mockResolvedValue({
      data: { status: "READY" },
      error: null,
    });
    expect(
      (
        await uploadRegistryFile(
          "VEHICLE_IMAGE",
          id,
          "Foto",
          new File(["x"], "x.jpg"),
        )
      ).id,
    ).toBeTruthy();
    expect(storage.remove).not.toHaveBeenCalled();
    expect(table.update).not.toHaveBeenCalledWith({ status: "FAILED" });
  });
  it("estado desconhecido após finalização preserva arquivo para reconciliação", async () => {
    updateQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "TIMEOUT" },
    });
    currentQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "TIMEOUT" },
    });
    await expect(
      uploadRegistryFile("VEHICLE_IMAGE", id, "Foto", new File(["x"], "x.jpg")),
    ).rejects.toMatchObject({ status: 503 });
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it("sem permissão não usa cliente privilegiado nem processa arquivo", async () => {
    mocks.guard.mockResolvedValue({
      staff: { id, permissions: ["vehicles.read"] },
    });
    await expect(
      uploadRegistryFile("VEHICLE_IMAGE", id, "Foto", new File(["x"], "x.jpg")),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
  it("gera UUID próprio, upload sem sobrescrita e só conclui após revalidar permissão", async () => {
    const result = await uploadRegistryFile(
      "VEHICLE_IMAGE",
      id,
      "Foto",
      new File(["x"], "x.jpg"),
    );
    expect(result.id).not.toBe(id);
    expect(table.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicle_id: id,
        uploaded_by: id,
        storage_path: `${id}/${result.id}.jpg`,
      }),
    );
    expect(storage.upload).toHaveBeenCalledWith(
      `${id}/${result.id}.jpg`,
      expect.any(Buffer),
      expect.objectContaining({ upsert: false, contentType: "image/jpeg" }),
    );
    expect(mocks.verified).toHaveBeenCalled();
    expect(table.update).toHaveBeenCalledWith({ status: "READY" });
  });
  it("falha de upload compensa somente o caminho desta operação e registra FAILED", async () => {
    storage.upload.mockResolvedValue({ error: { message: "offline" } });
    await expect(
      uploadRegistryFile("VEHICLE_IMAGE", id, "Foto", new File(["x"], "x.jpg")),
    ).rejects.toMatchObject({ status: 503 });
    const path = storage.upload.mock.calls[0][0];
    expect(storage.remove).toHaveBeenCalledWith([path]);
    expect(table.update).toHaveBeenCalledWith({ status: "FAILED" });
    expect(table.update).not.toHaveBeenCalledWith({ status: "READY" });
  });
  it("revogação durante upload impede disponibilização", async () => {
    mocks.verified.mockResolvedValue({ id, permissions: [] });
    await expect(
      uploadRegistryFile("VEHICLE_IMAGE", id, "Foto", new File(["x"], "x.jpg")),
    ).rejects.toMatchObject({ status: 403 });
    expect(storage.remove).toHaveBeenCalled();
    expect(table.update).not.toHaveBeenCalledWith({ status: "READY" });
  });
  it("download usa sessão/RLS, 60 segundos e nome sem dados pessoais", async () => {
    ownerQuery.maybeSingle.mockResolvedValue({
      data: {
        id,
        kind: "VEHICLE_IMAGE",
        label: "Foto",
        status: "READY",
        media_type: "image/jpeg",
        byte_size: 4,
        created_at: "2026-10-19",
        bucket: "vehicle-images",
        storage_path: `${id}/${id}.jpg`,
      },
      error: null,
    });
    await signRegistryFile(id);
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(storage.createSignedUrl).toHaveBeenCalledWith(
      `${id}/${id}.jpg`,
      60,
      { download: `arquivo-${id}.jpg` },
    );
  });
  it("arquivo pendente não gera link, mesmo para quem tem permissão", async () => {
    ownerQuery.maybeSingle.mockResolvedValue({
      data: {
        id,
        kind: "VEHICLE_IMAGE",
        label: "Foto",
        status: "PENDING",
        media_type: "image/jpeg",
        byte_size: 4,
        created_at: "2026-10-19",
        bucket: "vehicle-images",
        storage_path: `${id}/${id}.jpg`,
      },
      error: null,
    });
    await expect(signRegistryFile(id)).rejects.toMatchObject({ status: 403 });
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });
});
