import Link from "next/link";
import { Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WorkspaceHeading,
  EmptyRecords,
  RecordPagination,
} from "@/components/business/workspace";
import { registerKinds, registerLabels } from "@/lib/finance/schema";
import type { financeRegister, FinanceOptions } from "@/lib/finance/service";
import { currency } from "@/lib/finance/money";
import { businessDate, businessLabels } from "@/lib/business/format";
import { rentalLabels } from "@/lib/rentals/schema";
import { FinanceCreateForms, FinancialRowActions } from "./finance-forms";
const labels: Record<string, string> = {
  id: "Identificador",
  customer_name: "Cliente",
  customer_id: "Cliente",
  rental_id: "Locação",
  kind: "Tipo",
  description: "Descrição",
  due_at: "Vencimento",
  competence_at: "Competência",
  amount: "Valor",
  balance: "Saldo",
  confirmed_at: "Recebido em",
  free_amount: "Crédito livre",
  method: "Meio",
  created_at: "Registrado em",
  reason: "Motivo",
  occurred_at: "Data da despesa",
  reversible: "Estornável",
  charge_id: "Cobrança",
  vehicle_id: "Veículo",
  maintenance_record_id: "Manutenção",
  payment_id: "Pagamento",
  deposit_id: "Caução",
  payment_allocation_id: "Alocação",
};
const moneyKeys = new Set(["amount", "balance", "free_amount", "reversible"]),
  dateKeys = new Set([
    "due_at",
    "competence_at",
    "confirmed_at",
    "created_at",
    "occurred_at",
  ]);

const references = new Set([
  "id",
  "customer_id",
  "rental_id",
  "charge_id",
  "vehicle_id",
  "maintenance_record_id",
  "payment_id",
  "deposit_id",
  "payment_allocation_id",
]);
export type FinanceViewProps = {
  result: Awaited<ReturnType<typeof financeRegister>>;
  options: FinanceOptions;
  filters: {
    kind: (typeof registerKinds)[number];
    page: number;
    customer?: string | null;
    rental?: string | null;
  };
  query: string;
  permissions: string[];
  timezone: string;
};
export function FinanceView({
  result,
  options,
  filters: f,
  query,
  permissions,
  timezone,
}: FinanceViewProps) {
  const link = (kind: string, page = 1) =>
    `/admin/financeiro?${new URLSearchParams({ kind, page: String(page), q: query, ...(kind !== "EXPENSES" && f.customer ? { customer: f.customer } : {}), ...(kind !== "EXPENSES" && f.rental ? { rental: f.rental } : {}) })}`;
  const writable = [
    "charges.create",
    "payments.confirm",
    "deposits.manage",
    "expenses.write",
  ].some((p) => permissions.includes(p));
  const display = (key: string, value: unknown) =>
    moneyKeys.has(key)
      ? currency(value)
      : dateKeys.has(key)
        ? businessDate(String(value), timezone)
        : key === "kind"
          ? (businessLabels[String(value)] ?? String(value))
          : String(value);
  return (
    <>
      <WorkspaceHeading
        title="Financeiro"
        description="Consulte obrigações, valores recebidos e movimentações registradas."
        action={
          writable ? (
            <Button asChild>
              <a href="#novos-lancamentos">
                <Plus aria-hidden="true" />
                Novo lançamento
              </a>
            </Button>
          ) : undefined
        }
      />
      {permissions.includes("settings.manage") && (
        <div className="business-secondary-link">
          <Link className="text-link" href="/admin/financeiro/configuracao">
            <Settings2 size={16} aria-hidden="true" />
            Meios e limites
          </Link>
        </div>
      )}
      <p className="business-context-note">
        Cobranças são obrigações; recebimentos exigem confirmação. Cauções,
        aplicações e devoluções ficam em lançamentos separados.
      </p>
      <nav className="business-tabs" aria-label="Registros financeiros">
        {registerKinds.map((k) => (
          <Link
            key={k}
            aria-current={k === f.kind ? "page" : undefined}
            href={link(k)}
          >
            {registerLabels[k]}
          </Link>
        ))}
      </nav>
      <form method="get" className="records-filter finance-filter">
        <input type="hidden" name="kind" value={f.kind} />
        <label className="records-search">
          Buscar opções por nome ou identificador
          <input name="q" defaultValue={query} maxLength={100} />
          <span className="field-help">
            Até 100 opções por lista. Refine a busca para localizar outros
            registros.
          </span>
        </label>
        {f.kind !== "EXPENSES" && (
          <>
            <label>
              Cliente
              <select name="customer" defaultValue={f.customer ?? ""}>
                <option value="">Todos</option>
                {options.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Locação
              <select name="rental" defaultValue={f.rental ?? ""}>
                <option value="">Todas</option>
                {options.rentals.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id.slice(0, 8)} · {rentalLabels[r.status] ?? r.status}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <Button type="submit" variant="outline">
          Aplicar filtros
        </Button>
        <Link
          className="records-clear"
          href={`/admin/financeiro?kind=${f.kind}`}
        >
          Limpar
        </Link>
      </form>
      <section aria-labelledby="finance-register-title">
        <div className="business-section-heading">
          <h2 id="finance-register-title">{registerLabels[f.kind]}</h2>
          <p>{result.total} registro(s)</p>
        </div>
        {!result.rows.length ? (
          <EmptyRecords title="Nenhum lançamento encontrado">
            Revise os filtros para consultar outros registros. Os lançamentos
            dependem das permissões do seu perfil.
          </EmptyRecords>
        ) : (
          result.rows.map((row) => {
            const entries = Object.entries(row).filter(
              ([key, v]) =>
                v !== null &&
                !Array.isArray(v) &&
                !(key === "customer_id" && row.customer_name),
            );
            return (
              <article key={String(row.id)} className="finance-entry">
                <dl className="finance-entry-values">
                  {entries
                    .filter(([key]) => !references.has(key))
                    .map(([key, v]) => (
                      <div key={key}>
                        <dt>{labels[key] ?? key}</dt>
                        <dd
                          className={moneyKeys.has(key) ? "numeric" : undefined}
                        >
                          {display(key, v)}
                        </dd>
                      </div>
                    ))}
                </dl>
                <details className="record-reference">
                  <summary>
                    Referências do lançamento {String(row.id).slice(0, 8)}
                  </summary>
                  <dl className="business-references">
                    {entries
                      .filter(([key]) => references.has(key))
                      .map(([key, v]) => (
                        <div key={key}>
                          <dt>{labels[key] ?? key}</dt>
                          <dd>{String(v)}</dd>
                        </div>
                      ))}
                  </dl>
                </details>
                <FinancialRowActions
                  row={row}
                  kind={f.kind}
                  options={options}
                  permissions={permissions}
                />
              </article>
            );
          })
        )}
      </section>
      <RecordPagination
        page={f.page}
        total={result.total}
        pageSize={result.page_size}
        href={(p) => link(f.kind, p)}
        label="Paginação financeira"
      />
      {writable && (
        <section id="novos-lancamentos" className="business-section">
          <h2>Novos lançamentos</h2>
          <p className="field-help">
            Abra a operação desejada e confira os dados antes de confirmar.
            Horários no fuso {timezone}.
          </p>
          <FinanceCreateForms
            options={options}
            permissions={permissions}
            customer={f.customer}
            rental={f.rental}
            timezone={timezone}
          />
        </section>
      )}
    </>
  );
}
