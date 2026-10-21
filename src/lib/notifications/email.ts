import "server-only";
import { z } from "zod";
export class DeliveryError extends Error {
  constructor(
    public code:
      | "DELIVERY_FAILED"
      | "PROVIDER_REJECTED"
      | "RATE_LIMIT"
      | "TIMEOUT"
      | "AMBIGUOUS",
    public permanent = false,
  ) {
    super(code);
  }
}
export function emailConfiguration() {
  const provider = process.env.NOTIFICATION_EMAIL_PROVIDER,
    key = process.env.RESEND_API_KEY,
    from = process.env.NOTIFICATION_FROM;
  if (
    provider !== "resend" ||
    !key?.trim() ||
    !from ||
    !z.email().safeParse(from).success ||
    /[\r\n]/.test(from)
  )
    return null;
  return { key, from };
}
export async function sendTransactionalEmail(job: {
  id: string;
  recipient_email: string;
  sender_snapshot: string;
  subject_snapshot: string;
  body_snapshot: string;
}) {
  const config = emailConfiguration();
  if (!config) throw new DeliveryError("DELIVERY_FAILED");
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `locadora-notification-${job.id}`,
      },
      body: JSON.stringify({
        from: job.sender_snapshot,
        to: [job.recipient_email],
        subject: job.subject_snapshot,
        text: job.body_snapshot,
      }),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      cache: "no-store",
    });
  } catch (e) {
    throw new DeliveryError(
      e instanceof Error && ["TimeoutError", "AbortError"].includes(e.name)
        ? "TIMEOUT"
        : "AMBIGUOUS",
    );
  }
  if (!response.ok)
    throw new DeliveryError(
      response.status === 429
        ? "RATE_LIMIT"
        : response.status >= 500
          ? "DELIVERY_FAILED"
          : "PROVIDER_REJECTED",
      response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429,
    );
  try {
    const raw = await response.text();
    if (raw.length > 8192) throw new Error("INVALID_RESPONSE");
    return z
      .object({
        id: z
          .string()
          .min(1)
          .max(200)
          .regex(/^[a-zA-Z0-9_-]+$/),
      })
      .parse(JSON.parse(raw)).id;
  } catch {
    throw new DeliveryError("AMBIGUOUS");
  }
}
