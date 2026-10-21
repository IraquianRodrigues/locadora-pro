import Link from "next/link";
import { requirePageStaff } from "@/lib/auth/session";
import { businessDashboard } from "@/lib/reports/service";
import { periodSchema, reportDefaults } from "@/lib/reports/schema";
import { DashboardView } from "@/components/business/dashboard-view";
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { staff } = await requirePageStaff();
  const parsed = periodSchema.safeParse({
    ...reportDefaults(),
    ...(await searchParams),
  });
  if (!parsed.success)
    return (
      <>
        <h1>Visão geral</h1>
        <p role="alert">Período inválido; escolha até 366 dias.</p>
        <Link href="/admin/dashboard" className="text-link">
          Limpar filtros
        </Link>
      </>
    );
  return (
    <DashboardView
      data={await businessDashboard(parsed.data)}
      {...parsed.data}
      permissions={staff.permissions}
    />
  );
}
