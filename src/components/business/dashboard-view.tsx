import Link from "next/link";
import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PeriodForm } from "@/components/reports/period-form";
import { currency, netMoney } from "@/lib/finance/money";
import { businessDate } from "@/lib/business/format";
import type { businessDashboard } from "@/lib/reports/service";
export type DashboardData = Awaited<ReturnType<typeof businessDashboard>>;
export function DashboardView({
  data,
  from,
  to,
  permissions,
}: {
  data: DashboardData;
  from: string;
  to: string;
  permissions: readonly string[];
}) {
  const { operations: o, finance: f } = data;
  const can = (p: string) => permissions.includes(p);
  const tasks = [
    ...(o && can("reservations.read")
      ? [
          {
            href: "/admin/reservas",
            count: `${o.pending_reservations} em análise`,
            title: "Analisar reservas",
            description:
              "Acompanhe as solicitações e confirme a disponibilidade.",
          },
        ]
      : []),
    ...(o && can("rentals.read")
      ? [
          {
            href: "/admin/locacoes",
            count: `${o.active_rentals} locações abertas`,
            title: "Acompanhar locações",
            description:
              "Organize a retirada e os próximos passos de cada contrato.",
          },
          {
            href: "/admin/locacoes",
            count: `${o.next_returns.length} próximas devoluções listadas`,
            title: "Receber veículos",
            description:
              "Consulte as devoluções abertas previstas no período selecionado.",
          },
        ]
      : []),
  ];
  const primaryStats = o
    ? ([
        ["Disponíveis agora", o.available],
        ["Veículos em locação", o.occupied],
        ["Veículos em manutenção", o.maintenance],
        ["Frota ativa", o.active_vehicles],
      ] as const)
    : [];
  const financialRows = f
    ? [
        ["Contratado por competência", f.contracted],
        ["Recebimentos confirmados", f.received],
        ["Reembolsos de pagamentos", f.refunded],
        ["Despesas registradas", f.expenses],
        ["Estornos de despesas", f.expense_reversals],
        ["Cauções recebidas no período", f.deposit_received],
        ["Cauções devolvidas no período", f.deposit_refunded],
        ["Cauções disponíveis atualmente", f.deposit_held_now],
      ]
    : [];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Visão geral</h1>
          <p>Acompanhe a operação e organize os próximos passos.</p>
        </div>
        {can("reservations.request") && (
          <Button asChild>
            <Link href="/admin/reservas/nova">
              <Plus aria-hidden="true" />
              Nova reserva
            </Link>
          </Button>
        )}
      </div>
      <PeriodForm from={from} to={to} />
      {tasks.length > 0 && (
        <section className="operation-band" aria-labelledby="operation-title">
          <h2 id="operation-title">Próximos passos da operação</h2>
          <div className="operation-links">
            {tasks.map((task) => (
              <Link
                key={task.title}
                href={task.href}
                className="operation-link"
              >
                <ArrowRight aria-hidden="true" />
                <div>
                  <small>{task.count}</small>
                  <strong>{task.title}</strong>
                  <p>{task.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      {o && (
        <div className="dashboard-columns">
          <section aria-labelledby="fleet-title">
            <div className="section-heading">
              <h2 id="fleet-title">Disponibilidade da frota</h2>
              {can("vehicles.read") && (
                <Link className="text-link" href="/admin/frota">
                  Ver frota <ArrowUpRight aria-hidden="true" />
                </Link>
              )}
            </div>
            <p className="fleet-total">
              <strong className="numeric">{o.vehicles}</strong>veículos
              cadastrados
            </p>
            <dl className="data-rows">
              {primaryStats.map(([label, value]) => (
                <div key={label} className="data-row">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-labelledby="returns-title">
            <div className="section-heading">
              <h2 id="returns-title">Próximas devoluções</h2>
              {can("rentals.read") && (
                <Link className="text-link" href="/admin/locacoes">
                  Ver locações <ArrowUpRight aria-hidden="true" />
                </Link>
              )}
            </div>
            {o.next_returns.length ? (
              <ul className="return-list">
                {o.next_returns.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/locacoes/${r.id}`}>
                      Locação {r.id.slice(0, 8)}
                    </Link>
                    <time dateTime={r.end_at}>{businessDate(r.end_at)}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <strong>Nenhuma devolução aberta neste período.</strong>
                <p>
                  As próximas devoluções aparecerão aqui conforme as locações
                  forem registradas.
                </p>
              </div>
            )}
          </section>
          <section>
            <div className="section-heading">
              <h2>Reservas e locações</h2>
            </div>
            <dl className="data-rows">
              {[
                ["Reservas em análise", o.pending_reservations],
                ["Reservas confirmadas", o.confirmed_reservations],
                ["Locações abertas", o.active_rentals],
                ["Locações em atraso", o.overdue_rentals],
              ].map(([label, value]) => (
                <div key={label} className="data-row">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section>
            <div className="section-heading">
              <h2>Ocupação no período</h2>
            </div>
            <div className="empty-state">
              <strong className="numeric">
                {o.occupancy_percent === null
                  ? "Sem horas observadas"
                  : `${o.occupancy_percent.replace(".", ",")}% de ocupação efetiva`}
              </strong>
              <p>
                {o.coverage_limited
                  ? "Cobertura histórica limitada às horas de frota observadas desde a implantação do histórico."
                  : "Calculada a partir das horas de frota observadas no período selecionado."}
              </p>
            </div>
            {can("maintenance.read") && (
              <Link className="text-link mt-4" href="/admin/manutencao">
                Alertas de manutenção por data/km{" "}
                <ArrowRight aria-hidden="true" />
              </Link>
            )}
          </section>
        </div>
      )}
      {f && (
        <section className="dashboard-finance" aria-labelledby="finance-title">
          <div className="finance-heading">
            <h2 id="finance-title">Financeiro</h2>
            {can("finance.read") && (
              <Link href="/admin/financeiro" className="text-link">
                Ver financeiro <ArrowUpRight aria-hidden="true" />
              </Link>
            )}
          </div>
          <dl className="finance-summary">
            <div>
              <dt>Saldo atual a receber</dt>
              <dd className="numeric">{currency(f.receivable_now)}</dd>
            </div>
            <div>
              <dt>Recebido líquido no período</dt>
              <dd className="numeric">
                {currency(
                  netMoney(
                    { amount: f.received },
                    { amount: f.refunded, subtract: true },
                  ),
                )}
              </dd>
            </div>
            <div>
              <dt>Despesas líquidas no período</dt>
              <dd className="numeric">
                {currency(
                  netMoney(
                    { amount: f.expenses },
                    { amount: f.expense_reversals, subtract: true },
                  ),
                )}
              </dd>
            </div>
          </dl>
          <details className="finance-details">
            <summary>Ver composição dos valores e cauções</summary>
            <dl className="data-rows">
              {financialRows.map(([label, value]) => (
                <div className="data-row" key={label}>
                  <dt>{label}</dt>
                  <dd>{currency(value)}</dd>
                </div>
              ))}
            </dl>
          </details>
          <p className="dashboard-note">
            Recebimentos e reembolsos refletem confirmações manuais registradas.
            Caução permanece separada da receita; o painel não representa uma
            conciliação com banco ou adquirente.
          </p>
        </section>
      )}
      {!o && !f && (
        <div className="empty-state">
          <strong>Seu acesso está ativo.</strong>
          <p>
            Os indicadores dependem das permissões atribuídas à sua conta. Use o
            menu para acessar suas tarefas.
          </p>
        </div>
      )}
      <p className="dashboard-note">
        Indicadores de frota e pendências são atuais. Movimentações financeiras,
        competência e ocupação usam o período selecionado.
      </p>
    </>
  );
}
