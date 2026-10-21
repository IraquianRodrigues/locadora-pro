import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { databaseError } from "@/lib/registry/service";
import {
  DeliveryError,
  emailConfiguration,
  sendTransactionalEmail,
} from "./email";
const emailJob = z.object({
  id: z.uuid(),
  lease_token: z.uuid(),
  recipient_email: z.email(),
  sender_snapshot: z.email(),
  subject_snapshot: z.string(),
  body_snapshot: z.string(),
});
export async function processBusinessJobs() {
  const admin = createAdminClient();
  const overdue = await admin.rpc("mark_overdue_rentals", { batch_size: 100 });
  if (overdue.error) databaseError(overdue.error);
  const expired = await admin.rpc("expire_pending_reservations", {
    batch_size: 100,
  });
  if (expired.error) databaseError(expired.error);
  const alerts = await admin.rpc("queue_maintenance_alerts", {
    batch_size: 100,
  });
  if (alerts.error) databaseError(alerts.error);
  const dispatch = await admin.rpc("dispatch_notification_events", {
    batch_size: 100,
  });
  if (dispatch.error) databaseError(dispatch.error);
  const dispatched = z
    .object({
      completed: z.number(),
      failed: z.number(),
      deliveries: z.number(),
    })
    .parse(dispatch.data);
  const config = emailConfiguration();
  let sent = 0,
    failed = 0;
  if (config) {
    const claimed = await admin.rpc("claim_email_notifications", {
      batch_size: 3,
      sender: config.from,
    });
    if (claimed.error) databaseError(claimed.error);
    for (const job of z.array(emailJob).parse(claimed.data)) {
      try {
        const id = await sendTransactionalEmail(job);
        const done = await admin.rpc("finish_email_notification", {
          notification_id: job.id,
          lease: job.lease_token,
          provider_message_id: id,
          error_code: null,
          permanent: false,
        });
        if (done.error || !done.data) {
          failed++;
          continue;
        }
        sent++;
      } catch (e) {
        const failure =
          e instanceof DeliveryError ? e : new DeliveryError("AMBIGUOUS");
        await admin.rpc("finish_email_notification", {
          notification_id: job.id,
          lease: job.lease_token,
          provider_message_id: null,
          error_code: failure.code,
          permanent: failure.permanent,
        });
        failed++;
      }
    }
  }
  return {
    overdue: Number(overdue.data),
    expired: Number(expired.data),
    maintenance_alerts: Number(alerts.data),
    ...dispatched,
    email_configured: !!config,
    sent,
    email_failed: failed,
  };
}
