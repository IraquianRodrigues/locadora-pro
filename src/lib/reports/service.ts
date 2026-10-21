import "server-only";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { databaseError, RegistryError } from "@/lib/registry/service";
import { consumeLimit } from "@/lib/auth/limits";
import { netMoney } from "@/lib/finance/money";
import {
  financeReports,
  periodBounds,
  periodSchema,
  reportFilterSchema,
} from "./schema";
import { reportCsv } from "./csv";
export async function businessReport(raw: unknown) {
  const filters = reportFilterSchema.parse(raw),
    { client } = await requireStaff(
      financeReports.has(filters.kind)
        ? "reports.finance"
        : "reports.operations",
    );
  const r = await client.rpc("business_report", {
    report_kind: filters.kind,
    ...periodBounds({ from: filters.from, to: filters.to }),
    page: filters.page,
    page_size: filters.page_size,
  });
  if (r.error) databaseError(r.error);
  const result = z
    .object({
      rows: z.array(z.record(z.string(), z.string().nullable())),
      total: z.number(),
      page: z.number(),
      page_size: z.number(),
      kind: z.string(),
    })
    .parse(r.data);
  if (filters.kind === "PROFITABILITY")
    result.rows = result.rows.map((row) => ({
      ...row,
      net_expenses: netMoney(
        { amount: row.expenses },
        { amount: row.expense_reversals, subtract: true },
      ),
      contracted_result: netMoney(
        { amount: row.contracted },
        { amount: row.expenses, subtract: true },
        { amount: row.expense_reversals },
      ),
    }));
  return result;
}
const amount = z.string().regex(/^-?\d+(\.\d{1,2})?$/);
const dashboardSchema = z.object({
  operations: z
    .object({
      vehicles: z.number(),
      active_vehicles: z.number(),
      maintenance: z.number(),
      occupied: z.number(),
      available: z.number(),
      pending_reservations: z.number(),
      confirmed_reservations: z.number(),
      active_rentals: z.number(),
      overdue_rentals: z.number(),
      occupancy_percent: z.string().nullable(),
      coverage_limited: z.boolean(),
      next_returns: z.array(z.object({ id: z.uuid(), end_at: z.string() })),
    })
    .optional(),
  finance: z
    .object({
      contracted: amount,
      received: amount,
      refunded: amount,
      receivable_now: amount,
      deposit_received: amount,
      deposit_refunded: amount,
      deposit_held_now: amount,
      expenses: amount,
      expense_reversals: amount,
    })
    .optional(),
});
export async function businessDashboard(raw: unknown) {
  const { client } = await requireStaff(),
    bounds = periodBounds(raw);
  const r = await client.rpc("business_dashboard", bounds);
  if (r.error) databaseError(r.error);
  return dashboardSchema.parse(r.data);
}
export async function exportReport(raw: unknown) {
  const filters = reportFilterSchema.parse(raw),
    { client, staff } = await requireStaff(
      financeReports.has(filters.kind)
        ? "reports.finance"
        : "reports.operations",
    );
  if (!(await consumeLimit("report-export", staff.id, 10)))
    throw new RegistryError(
      429,
      "RATE_LIMITED",
      "Limite de exportações atingido. Aguarde alguns minutos.",
    );
  const result = await businessReport(filters),
    columns = result.rows.length
      ? Object.keys(result.rows[0])
      : ["sem_registros"];
  const audit = await client.rpc("audit_report_export", {
    report_kind: filters.kind,
    ...periodBounds(periodSchema.parse({ from: filters.from, to: filters.to })),
    page: filters.page,
    row_count: result.rows.length,
  });
  if (audit.error) databaseError(audit.error);
  return {
    body: reportCsv(result.rows, columns),
    filename: `${filters.kind.toLowerCase()}-${filters.from}-${filters.to}-pagina-${filters.page}.csv`,
  };
}
