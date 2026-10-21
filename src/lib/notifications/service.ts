import "server-only";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { databaseError } from "@/lib/registry/service";
import { idempotencySchema } from "@/lib/reservations/schema";
import { notificationSetupSchema, retryNotificationSchema } from "./schema";
export async function setupNotifications(raw: unknown, key: unknown) {
  const { client } = await requireStaff("settings.manage"),
    input = notificationSetupSchema.parse(raw);
  const r = await client.rpc("notification_setup", {
    input,
    idempotency_key: idempotencySchema.parse(key),
  });
  if (r.error) databaseError(r.error);
  return z.object({ id: z.uuid() }).parse(r.data);
}
export async function retryNotification(raw: unknown, key: unknown) {
  const { client } = await requireStaff("settings.manage"),
    input = retryNotificationSchema.parse(raw);
  const r = await client.rpc("retry_notification", {
    input,
    idempotency_key: idempotencySchema.parse(key),
  });
  if (r.error) databaseError(r.error);
  return z.object({ id: z.uuid() }).parse(r.data);
}
export async function listNotifications(rawPage: unknown = 1) {
  const page = z.coerce.number().int().min(1).max(10000).parse(rawPage),
    { client, staff } = await requireStaff();
  const r = await client
    .from("notifications")
    .select("id,subject_snapshot,body_snapshot,read_at,created_at", {
      count: "exact",
    })
    .eq("channel", "IN_APP")
    .eq("recipient_profile_id", staff.id)
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 20, page * 20 - 1);
  if (r.error) databaseError(r.error);
  return {
    rows: z
      .array(
        z.object({
          id: z.uuid(),
          subject_snapshot: z.string().nullable(),
          body_snapshot: z.string().nullable(),
          read_at: z.string().nullable(),
          created_at: z.string(),
        }),
      )
      .parse(r.data),
    page,
    total: r.count ?? 0,
  };
}
export async function readNotification(id: string) {
  const { client } = await requireStaff();
  const r = await client.rpc("read_notification", {
    notification_id: z.uuid().parse(id),
  });
  if (r.error) databaseError(r.error);
}
const jobSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  attempts: z.number(),
  last_error_code: z.string().nullable(),
  created_at: z.string(),
  event_type: z.string().optional(),
  provider_id: z.string().nullable().optional(),
  first_attempt_at: z.string().nullable().optional(),
});
export async function notificationConfiguration() {
  const { client } = await requireStaff("settings.manage");
  const [routes, templates, jobs] = await Promise.all([
    client
      .from("notification_routes")
      .select("id,event_type,channel,target,template_id,enabled,updated_at")
      .order("event_type"),
    client
      .from("notification_templates")
      .select("id,template_key,version,channel,subject,body")
      .order("created_at", { ascending: false })
      .limit(100),
    client.rpc("notification_job_status"),
  ]);
  for (const r of [routes, templates, jobs])
    if (r.error) databaseError(r.error);
  return {
    routes: z
      .array(
        z.object({
          id: z.uuid(),
          event_type: z.string(),
          channel: z.string(),
          target: z.string(),
          template_id: z.uuid(),
          enabled: z.boolean(),
          updated_at: z.string(),
        }),
      )
      .parse(routes.data),
    templates: z
      .array(
        z.object({
          id: z.uuid(),
          template_key: z.string(),
          version: z.number(),
          channel: z.string(),
          subject: z.string(),
          body: z.string(),
        }),
      )
      .parse(templates.data),
    jobs: z
      .object({ outbox: z.array(jobSchema), email: z.array(jobSchema) })
      .parse(jobs.data),
  };
}
