import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  configuration: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: m.rpc }),
}));
vi.mock("@/lib/notifications/email", async (original) => ({
  ...(await original<typeof import("@/lib/notifications/email")>()),
  emailConfiguration: m.configuration,
  sendTransactionalEmail: m.send,
}));
import { processBusinessJobs } from "@/lib/notifications/worker";
const id = "f8000000-0000-4000-8000-000000000001",
  lease = "f8000000-0000-4000-8000-000000000002";
beforeEach(() => {
  vi.resetAllMocks();
  m.configuration.mockReturnValue({
    from: "sender@example.invalid",
    key: "fake",
  });
  m.send.mockResolvedValue("provider-id");
  m.rpc.mockImplementation(async (name: string) => ({
    error: null,
    data:
      name === "dispatch_notification_events"
        ? { completed: 2, failed: 0, deliveries: 4 }
        : name === "claim_email_notifications"
          ? [
              {
                id,
                lease_token: lease,
                recipient_email: "customer@example.invalid",
                sender_snapshot: "sender@example.invalid",
                subject_snapshot: "Atualização",
                body_snapshot: "Atualização do registro",
              },
            ]
          : name === "finish_email_notification"
            ? true
            : 1,
  }));
});
it("sem provedor processa painel sem consumir tentativas de email", async () => {
  m.configuration.mockReturnValue(null);
  const result = await processBusinessJobs();
  expect(result.email_configured).toBe(false);
  expect(result.deliveries).toBe(4);
  expect(
    m.rpc.mock.calls.some(([name]) => name === "claim_email_notifications"),
  ).toBe(false);
  expect(m.send).not.toHaveBeenCalled();
});
it("aceitação do provedor só conta após confirmação da lease", async () => {
  expect((await processBusinessJobs()).sent).toBe(1);
  expect(m.rpc).toHaveBeenCalledWith("finish_email_notification", {
    notification_id: id,
    lease,
    provider_message_id: "provider-id",
    error_code: null,
    permanent: false,
  });
});
it("commit ambíguo não anuncia envio confirmado nem cria uma nova mensagem", async () => {
  const impl = m.rpc.getMockImplementation()!;
  m.rpc.mockImplementation(async (name: string, ...args: unknown[]) =>
    name === "finish_email_notification"
      ? { data: null, error: { code: "TIMEOUT" } }
      : impl(name, ...args),
  );
  const result = await processBusinessJobs();
  expect(result.sent).toBe(0);
  expect(result.email_failed).toBe(1);
  expect(m.send).toHaveBeenCalledTimes(1);
});
it("falha do provedor grava apenas código sanitizado", async () => {
  m.send.mockRejectedValue(new Error("private provider detail"));
  expect((await processBusinessJobs()).email_failed).toBe(1);
  expect(m.rpc).toHaveBeenCalledWith("finish_email_notification", {
    notification_id: id,
    lease,
    provider_message_id: null,
    error_code: "AMBIGUOUS",
    permanent: false,
  });
});
