import Link from "next/link";
import { z } from "zod";
import { requirePageStaff } from "@/lib/auth/session";
import { financeFilterSchema } from "@/lib/finance/schema";
import { financeOptions, financeRegister } from "@/lib/finance/service";
import { businessTimezone } from "@/lib/business/format";
import { FinanceView } from "@/components/finance/finance-view";
import { WorkspaceHeading } from "@/components/business/workspace";
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { staff } = await requirePageStaff("finance.read"),
    { q: rawSearch, ...rawFilters } = await searchParams,
    query = z.string().trim().max(100).default("").safeParse(rawSearch),
    parsed = financeFilterSchema.safeParse(rawFilters);
  if (!parsed.success || !query.success)
    return (
      <>
        <WorkspaceHeading title="Financeiro" />
        <p role="alert">
          Filtros inválidos. Despesas não aceitam filtro de cliente ou locação.
        </p>
        <Link className="text-link" href="/admin/financeiro">
          Limpar filtros
        </Link>
      </>
    );
  const [result, options] = await Promise.all([
    financeRegister(parsed.data),
    financeOptions(query.data),
  ]);
  return (
    <FinanceView
      result={result}
      options={options}
      filters={parsed.data}
      query={query.data}
      permissions={staff.permissions}
      timezone={businessTimezone()}
    />
  );
}
