import Link from "next/link";
import { z } from "zod";
import { requirePageStaff } from "@/lib/auth/session";
import { listNotifications } from "@/lib/notifications/service";
import { NotificationList } from "@/components/notifications/notification-list";
import { WorkspaceHeading } from "@/components/business/workspace";
import { businessTimezone } from "@/lib/business/format";
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { staff } = await requirePageStaff(),
    raw = await searchParams,
    parsed = z
      .object({ page: z.coerce.number().int().min(1).max(10000).default(1) })
      .safeParse(raw);
  if (!parsed.success)
    return (
      <>
        <WorkspaceHeading title="Notificações" />
        <p role="alert">Página inválida.</p>
        <Link className="business-secondary-link" href="/admin/notificacoes">
          Limpar filtros
        </Link>
      </>
    );
  const result = await listNotifications(parsed.data.page);
  return (
    <NotificationList
      result={result}
      canConfigure={staff.permissions.includes("settings.manage")}
      timezone={businessTimezone()}
    />
  );
}
