import { requirePageStaff } from "@/lib/auth/session";
import { notificationConfiguration } from "@/lib/notifications/service";
import { emailConfiguration } from "@/lib/notifications/email";
import { NotificationConfigurationView } from "@/components/notifications/configuration-view";
import { businessTimezone } from "@/lib/business/format";
export default async function NotificationConfigurationPage() {
  await requirePageStaff("settings.manage");
  const data = await notificationConfiguration();
  return (
    <NotificationConfigurationView
      data={data}
      emailConfigured={!!emailConfiguration()}
      timezone={businessTimezone()}
    />
  );
}
