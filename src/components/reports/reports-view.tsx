import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WorkspaceHeading,
  EmptyRecords,
  RecordPagination,
} from "@/components/business/workspace";
import type { businessReport } from "@/lib/reports/service";
import { reportLabels, type reportFilterSchema } from "@/lib/reports/schema";
import type { z } from "zod";
import { currency } from "@/lib/finance/money";
import { businessDate, businessLabels } from "@/lib/business/format";
import { PeriodForm } from "./period-form";
const labels: Record<string, string> = {
  id: "Identificador",
  customer_id: "Identificador do cliente",
  customer: "Cliente",
  rental_id: "Identificador da locação",
  kind: "Tipo",
  competence: "Competência",
  due_at: "Vencimento",
  gross: "Valor original",
  contracted: "Contratado líquido",
  date: "Data",
  amount: "Valor",
  vehicle_id: "Identificador do veículo",
  vehicle: "Veículo",
  description: "Descrição",
  balance: "Saldo atual",
  expenses: "Despesas pagas",
  expense_reversals: "Estornos",
  net_expenses: "Despesas líquidas",
  contracted_result: "Resultado contratado",
  status: "Situação",
  count: "Quantidade",
  fleet_hours: "Horas da frota ativa",
  rented_hours: "Horas em locação",
  occupancy_percent: "Ocupação (%)",
  coverage_limited: "Cobertura histórica limitada",
  rentals: "Locações",
  expected_return: "Devolução prevista",
  mileage: "Km",
  completed_at: "Concluída em",
  next_due_on: "Próxima data",
  next_due_mileage: "Próximo km",
};
const money = new Set([
  "gross",
  "contracted",
  "amount",
  "balance",
  "expenses",
  "expense_reversals",
  "net_expenses",
  "contracted_result",
]);
const dates = new Set([
  "competence",
  "due_at",
  "date",
  "expected_return",
  "completed_at",
  "next_due_on",
]);
const notes: Record<string, string> = {
  REVENUE:
    "Obrigações por competência; descontos e cancelamentos conhecidos até o fim do período. Este valor não comprova recebimento.",
  RECEIPTS:
    "Entradas efetivamente confirmadas e reembolsos de pagamentos pelas datas de registro. Cauções não entram nesta receita recebida.",
  EXPENSES:
    "Despesas pelas datas informadas de pagamento e estornos pelas datas de registro. Valores negativos são compensações.",
  PROFITABILITY:
    "Resultado contratado menos despesas líquidas vinculadas ao veículo. Sem depreciação, impostos ou rateio de despesas gerais; não equivale a lucro contábil ou saldo bancário.",
  BALANCES:
    "Saldo atual das cobranças cujo vencimento está no período; não reconstrói o saldo de uma data passada.",
  OCCUPANCY:
    "Horas efetivas em locação / horas de frota ativa observadas, limitadas ao momento atual. Cobertura histórica limitada indica ausência de dados anteriores à implantação; períodos futuros não são realizados.",
  RECURRING:
    "Clientes com mais de uma locação não cancelada com início previsto no período.",
  OVERDUE:
    "Locações atualmente abertas e vencidas, filtradas pelo fim previsto no período.",
  MAINTENANCE:
    "Serviços concluídos pela data efetiva de conclusão; registros legados usam o fim previsto.",
  RESERVATIONS: "Situação atual das reservas com início previsto no período.",
};

export type ReportData = Awaited<ReturnType<typeof businessReport>>;
export type ReportFilters = z.infer<typeof reportFilterSchema>;
export function ReportsView({
  filters: f,
  result,
  allowed,
  timezone,
  preview = false,
}: {
  filters: ReportFilters;
  result: ReportData;
  allowed: string[];
  timezone: string;
  preview?: boolean;
}) {
  const allColumns = result.rows.length ? Object.keys(result.rows[0]) : [];
  const referenceColumns = allColumns.filter(
    (c) => c === "id" || c.endsWith("_id"),
  );
  const columns = allColumns.filter((c) => !referenceColumns.includes(c));
  const query = (page: number) =>
    new URLSearchParams({
      ...f,
      page: String(page),
      page_size: String(f.page_size),
    }).toString();
  const display = (c: string, v: string | null) =>
    v === null
      ? "—"
      : money.has(c)
        ? currency(v)
        : c === "coverage_limited"
          ? v === "true"
            ? "Sim"
            : "Não"
          : dates.has(c)
            ? businessDate(v, timezone)
            : ["kind", "status"].includes(c)
              ? (businessLabels[v] ?? v)
              : v;
  return (
    <>
      <WorkspaceHeading
        title="Relatórios"
        description="Consulte os resultados por período e exporte a página selecionada."
      />
      <div className="reports-filter">
        <PeriodForm from={f.from} to={f.to}>
          <label>
            Relatório
            <select name="kind" defaultValue={f.kind}>
              {allowed.map((k) => (
                <option key={k} value={k}>
                  {reportLabels[k as keyof typeof reportLabels]}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="page_size" value={f.page_size} />
        </PeriodForm>
      </div>
      <section aria-labelledby="report-title">
        <div className="business-section-heading">
          <h2 id="report-title">{reportLabels[f.kind]}</h2>
          <p>{result.total} registro(s)</p>
        </div>
        <p className="business-context-note">{notes[f.kind]}</p>
        <p className="field-help">
          Datas civis inclusivas no fuso {timezone}. Período máximo de 366 dias.
        </p>
        <div className="report-export">
          {preview ? (
            <>
              <Button variant="outline" disabled>
                <Download size={16} aria-hidden="true" />
                Exportar esta página em CSV ({result.rows.length} linhas)
              </Button>
              <p className="field-help">
                Exportação indisponível na prévia ilustrativa. Use a aplicação
                com sessão autorizada.
              </p>
            </>
          ) : (
            <Button asChild variant="outline">
              <a href={`/api/v1/admin/reports/export?${query(f.page)}`}>
                <Download size={16} aria-hidden="true" />
                Exportar esta página em CSV ({result.rows.length} linhas)
              </a>
            </Button>
          )}
        </div>
        {result.rows.length ? (
          <table className="records-table reports-table">
            <caption className="sr-only">
              {reportLabels[f.kind]} · página {f.page}
            </caption>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th scope="col" key={c}>
                    {labels[c] ?? c}
                  </th>
                ))}
                {referenceColumns.length > 0 && (
                  <th scope="col">Referências</th>
                )}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r, i) => (
                <tr key={r.id ?? r.vehicle_id ?? r.customer_id ?? String(i)}>
                  {columns.map((c) => (
                    <td
                      key={c}
                      data-label={labels[c] ?? c}
                      className={money.has(c) ? "numeric" : undefined}
                    >
                      <span>{display(c, r[c])}</span>
                    </td>
                  ))}
                  {referenceColumns.length > 0 && (
                    <td data-label="Referências">
                      <details className="report-references">
                        <summary>
                          Ver referências
                          <span className="sr-only"> · linha {i + 1}</span>
                        </summary>
                        <dl>
                          {referenceColumns.map((c) => (
                            <div key={c}>
                              <dt>{labels[c] ?? c}</dt>
                              <dd>{r[c] ?? "—"}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyRecords title="Nenhum registro no período">
            Revise o tipo de relatório e as datas para consultar outros
            registros.
          </EmptyRecords>
        )}
      </section>
      <RecordPagination
        page={f.page}
        total={result.total}
        pageSize={f.page_size}
        href={(page) => `/admin/relatorios?${query(page)}`}
        label="Paginação de relatórios"
      />
    </>
  );
}
