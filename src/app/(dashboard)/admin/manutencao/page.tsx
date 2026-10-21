import Link from "next/link";
import { requirePageStaff } from "@/lib/auth/session";
import { listMaintenance, maintenanceAlerts } from "@/lib/maintenance/service";
import { maintenanceFilters } from "@/lib/maintenance/schema";
import { businessTimezone } from "@/lib/business/format";
import { MaintenanceList } from "@/components/maintenance/maintenance-view";
import { WorkspaceHeading } from "@/components/business/workspace";
export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { staff } = await requirePageStaff("maintenance.read"),
    filters = maintenanceFilters.safeParse(await searchParams);
  if (!filters.success)
    return (
      <>
        <WorkspaceHeading title="Manutenção" />
        <p role="alert">Filtros inválidos.</p>
        <Link className="text-link" href="/admin/manutencao">
          Limpar filtros
        </Link>
      </>
    );
  const [list, alerts] = await Promise.all([
    listMaintenance(filters.data),
    maintenanceAlerts(),
  ]);
  return (
    <MaintenanceList
      list={list}
      alerts={alerts}
      status={filters.data.status ?? ""}
      permissions={staff.permissions}
      timezone={businessTimezone()}
    />
  );
}
