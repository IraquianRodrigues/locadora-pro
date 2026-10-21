import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  emailConfiguration,
  sendTransactionalEmail,
} from "@/lib/notifications/email";
const job = {
  id: "f8000000-0000-4000-8000-000000000001",
  recipient_email: "customer@example.invalid",
  sender_snapshot: "sender@example.invalid",
  subject_snapshot: "Reserva confirmada",
  body_snapshot: "Seu registro foi confirmado.",
};
beforeEach(() => {
  vi.stubEnv("NOTIFICATION_EMAIL_PROVIDER", "resend");
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("NOTIFICATION_FROM", "sender@example.invalid");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("provedor incompleto não faz requisição", async () => {
  vi.stubEnv("RESEND_API_KEY", "");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(emailConfiguration()).toBe(null);
  await expect(sendTransactionalEmail(job)).rejects.toMatchObject({
    code: "DELIVERY_FAILED",
  });
  expect(fetch).not.toHaveBeenCalled();
});
it("envia texto e snapshot com chave estável de idempotência", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ id: "provider-123" }));
  vi.stubGlobal("fetch", fetch);
  expect(await sendTransactionalEmail(job)).toBe("provider-123");
  expect(fetch).toHaveBeenCalledWith(
    "https://api.resend.com/emails",
    expect.objectContaining({
      redirect: "error",
      cache: "no-store",
      headers: expect.objectContaining({
        "Idempotency-Key": `locadora-notification-${job.id}`,
      }),
      body: JSON.stringify({
        from: job.sender_snapshot,
        to: [job.recipient_email],
        subject: job.subject_snapshot,
        text: job.body_snapshot,
      }),
    }),
  );
});
it.each([
  [429, "RATE_LIMIT", false],
  [503, "DELIVERY_FAILED", false],
  [422, "PROVIDER_REJECTED", true],
])(
  "HTTP %i tem política de repetição segura",
  async (status, code, permanent) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("provider detail", { status: Number(status) }),
        ),
    );
    await expect(sendTransactionalEmail(job)).rejects.toMatchObject({
      message: code,
      code,
      permanent,
    });
  },
);
it("resposta inválida ou perdida permanece ambígua, sem presumir sucesso", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ unexpected: "private data" })),
  );
  await expect(sendTransactionalEmail(job)).rejects.toMatchObject({
    code: "AMBIGUOUS",
  });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private error")));
  await expect(sendTransactionalEmail(job)).rejects.toMatchObject({
    message: "AMBIGUOUS",
  });
});
