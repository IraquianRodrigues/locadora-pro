import Link from "next/link";
import { requirePageStaff, AccessError } from "@/lib/auth/session";
import { businessReport } from "@/lib/reports/service";
import {
  reportDefaults,
  reportFilterSchema,
  reportLabels,
  financeReports,
} from "@/lib/reports/schema";
import { businessTimezone } from "@/lib/business/format";
import { ReportsView } from "@/components/reports/reports-view";
import { WorkspaceHeading } from "@/components/business/workspace";
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { staff } = await requirePageStaff(),
    allowed = Object.keys(reportLabels).filter((k) =>
      staff.permissions.includes(
        financeReports.has(k) ? "reports.finance" : "reports.operations",
      ),
    );
  if (!allowed.length) throw new AccessError(403);
  const raw = await searchParams,
    parsed = reportFilterSchema.safeParse({
      ...reportDefaults(),
      kind: allowed[0],
      ...raw,
    });
  if (!parsed.success)
    return (
      <>
        <WorkspaceHeading title="Relatórios" />
        <p role="alert">
          Filtros inválidos. Escolha um período de até 366 dias.
        </p>
        <Link className="text-link" href="/admin/relatorios">
          Limpar filtros
        </Link>
      </>
    );
  const result = await businessReport(parsed.data);
  return (
    <ReportsView
      filters={parsed.data}
      result={result}
      allowed={allowed}
      timezone={businessTimezone()}
    />
  );
}
