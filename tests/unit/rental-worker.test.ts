import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  current: vi.fn(),
  render: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: m.rpc,
    storage: { from: () => ({ upload: m.upload, remove: m.remove }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: m.current }) }),
    }),
  }),
}));
vi.mock("@/lib/rentals/contract-pdf", () => ({ renderContractPdf: m.render }));
import { processRentalJobs } from "@/lib/rentals/worker";
const id = "f7000000-0000-4000-8000-000000000001",
  lease = "f7000000-0000-4000-8000-000000000002",
  job = {
    id,
    rental_id: id,
    lease_token: lease,
    version: 1,
    snapshot: {},
    created_at: "2026-10-20T00:00:00Z",
  };
beforeEach(() => {
  vi.resetAllMocks();
  m.render.mockResolvedValue(Buffer.from("%PDF-test"));
  m.upload.mockResolvedValue({ error: null });
  m.remove.mockResolvedValue({ error: null });
  m.rpc.mockImplementation(async (name: string) =>
    name === "mark_overdue_rentals"
      ? { data: 2, error: null }
      : name === "claim_contract_jobs"
        ? { data: [job], error: null }
        : { data: true, error: null },
  );
  m.current.mockResolvedValue({
    data: { generation_status: "PENDING", storage_path: null },
    error: null,
  });
});
describe("worker de contratos", () => {
  it("gera hash dos bytes, publica sem upsert e conclui com token da tentativa", async () => {
    expect(await processRentalJobs()).toEqual({
      generated: 1,
      failed: 0,
      processed: 1,
      overdue: 2,
    });
    expect(m.upload).toHaveBeenCalledWith(
      `${id}/${lease}.pdf`,
      expect.any(Buffer),
      { contentType: "application/pdf", cacheControl: "0", upsert: false },
    );
    expect(m.rpc).toHaveBeenCalledWith(
      "finish_contract_job",
      expect.objectContaining({
        contract_id: id,
        lease,
        file_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("falha de render não anuncia sucesso e agenda retry sem expor detalhes", async () => {
    m.render.mockRejectedValue(new Error("sensitive implementation detail"));
    expect((await processRentalJobs()).failed).toBe(1);
    expect(m.upload).not.toHaveBeenCalled();
    expect(m.rpc).toHaveBeenCalledWith("finish_contract_job", {
      contract_id: id,
      lease,
      path: null,
      file_hash: null,
    });
  });
  it("resposta perdida após commit nunca apaga um contrato publicado", async () => {
    m.rpc.mockImplementation(async (name: string) =>
      name === "mark_overdue_rentals"
        ? { data: 0, error: null }
        : name === "claim_contract_jobs"
          ? { data: [job], error: null }
          : { data: null, error: { code: "TIMEOUT" } },
    );
    m.current.mockResolvedValue({
      data: {
        generation_status: "GENERATED",
        storage_path: `${id}/${lease}.pdf`,
      },
      error: null,
    });
    expect((await processRentalJobs()).generated).toBe(1);
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("tentativa com lease vencido remove só o objeto desta tentativa", async () => {
    m.rpc.mockImplementation(async (name: string) =>
      name === "mark_overdue_rentals"
        ? { data: 0, error: null }
        : name === "claim_contract_jobs"
          ? { data: [job], error: null }
          : { data: false, error: null },
    );
    expect((await processRentalJobs()).failed).toBe(1);
    expect(m.remove).toHaveBeenCalledWith([`${id}/${lease}.pdf`]);
  });
  it("confirmação ambígua e banco indisponível preservam objeto para reconciliação", async () => {
    m.rpc.mockImplementation(async (name: string) =>
      name === "mark_overdue_rentals"
        ? { data: 0, error: null }
        : name === "claim_contract_jobs"
          ? { data: [job], error: null }
          : { data: null, error: { code: "TIMEOUT" } },
    );
    m.current.mockResolvedValue({ data: null, error: { code: "TIMEOUT" } });
    expect((await processRentalJobs()).failed).toBe(1);
    expect(m.remove).not.toHaveBeenCalled();
  });
});
