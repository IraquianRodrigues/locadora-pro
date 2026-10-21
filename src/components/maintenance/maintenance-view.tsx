import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BackLink,
  WorkspaceHeading,
  RecordStatus,
  EmptyRecords,
  RecordPagination,
} from "@/components/business/workspace";
import {
  maintenanceKinds,
  maintenanceStatuses,
} from "@/lib/maintenance/schema";
import { businessDate } from "@/lib/business/format";
import type {
  listMaintenance,
  maintenanceAlerts,
  getMaintenance,
} from "@/lib/maintenance/service";
import { MaintenanceWorkflow } from "./maintenance-forms";
const kindLabel = (kind: string) =>
  maintenanceKinds[kind as keyof typeof maintenanceKinds] ?? kind;
const statusLabel = (status: string) =>
  maintenanceStatuses[status as keyof typeof maintenanceStatuses] ?? status;
export type MaintenanceListData = Awaited<ReturnType<typeof listMaintenance>>;
export type MaintenanceAlertsData = Awaited<
  ReturnType<typeof maintenanceAlerts>
>;
export type MaintenanceDetailData = Awaited<ReturnType<typeof getMaintenance>>;
export function MaintenanceList({
  list,
  alerts,
  status,
  permissions,
  timezone,
}: {
  list: MaintenanceListData;
  alerts: MaintenanceAlertsData;
  status: string;
  permissions: string[];
  timezone: string;
}) {
  return (
    <>
      <WorkspaceHeading
        title="Manutenção"
        description="Consulte os serviços, os prazos e os bloqueios de disponibilidade."
        action={
          permissions.includes("maintenance.write") ? (
            <Button asChild>
              <Link href="/admin/manutencao/nova">
                <Plus aria-hidden="true" />
                Agendar manutenção
              </Link>
            </Button>
          ) : undefined
        }
      />
      {(alerts.due.length > 0 || alerts.unfinished.length > 0) && (
        <details className="business-alert">
          <summary>
            Alertas por data, quilometragem e prazo ·{" "}
            {alerts.due.length + alerts.unfinished.length} listado(s)
          </summary>
          <p>
            Confira as referências dos serviços e trate os prazos ultrapassados
            antes de nova retirada.
          </p>
          <ul>
            {alerts.due.map((a) => (
              <li key={a.id}>
                <Link className="text-link" href={`/admin/manutencao/${a.id}`}>
                  {kindLabel(a.kind)} · veículo {a.vehicle_id.slice(0, 8)}
                </Link>
                <p>
                  Km atual {a.current_mileage} · próxima data{" "}
                  {a.next_due_on ? businessDate(a.next_due_on, timezone) : "—"}{" "}
                  / km {a.next_due_mileage ?? "—"}
                </p>
              </li>
            ))}
            {alerts.unfinished.map((a) => (
              <li key={a.id}>
                <Link className="text-link" href={`/admin/manutencao/${a.id}`}>
                  Manutenção {a.id.slice(0, 8)} com prazo ultrapassado
                </Link>
                <p>Trate o serviço antes de nova retirada.</p>
              </li>
            ))}
          </ul>
        </details>
      )}
      <form method="get" className="records-filter">
        <label>
          Situação
          <select name="status" defaultValue={status}>
            <option value="">Todas</option>
            {Object.entries(maintenanceStatuses).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          Aplicar filtros
        </Button>
        <Link className="records-clear" href="/admin/manutencao">
          Limpar
        </Link>
      </form>
      <div className="records-context">
        <p>
          {list.total} serviço(s). Horários no fuso {timezone}.
        </p>
      </div>
      {!list.rows.length ? (
        <EmptyRecords title="Nenhuma manutenção encontrada">
          Revise a situação selecionada ou agende um serviço, conforme sua
          permissão.
        </EmptyRecords>
      ) : (
        <table className="records-table">
          <caption className="sr-only">
            Manutenções · resultados da consulta
          </caption>
          <thead>
            <tr>
              <th scope="col">Serviço</th>
              <th scope="col">Período previsto</th>
              <th scope="col">Situação</th>
              <th scope="col">Disponibilidade</th>
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.rows.map((m) => (
              <tr key={m.id}>
                <th scope="row">
                  <Link
                    className="record-name"
                    href={`/admin/manutencao/${m.id}`}
                  >
                    {kindLabel(m.kind)}
                  </Link>
                  <small>Serviço {m.id.slice(0, 8)}</small>
                </th>
                <td data-label="Período previsto">
                  {businessDate(m.start_at, timezone)}
                  <small>até {businessDate(m.end_at, timezone)}</small>
                </td>
                <td data-label="Situação">
                  <RecordStatus attention={m.status === "IN_PROGRESS"}>
                    {statusLabel(m.status)}
                  </RecordStatus>
                </td>
                <td data-label="Disponibilidade">
                  {m.blocks_availability
                    ? "Com bloqueio no período"
                    : "Sem bloqueio no período"}
                </td>
                <td className="record-open">
                  <Link
                    href={`/admin/manutencao/${m.id}`}
                    aria-label={`Abrir manutenção ${m.id.slice(0, 8)}`}
                  >
                    Abrir
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <RecordPagination
        page={list.page}
        total={list.total}
        pageSize={20}
        href={(page) =>
          `/admin/manutencao?${new URLSearchParams({ page: String(page), status })}`
        }
        label="Paginação de manutenção"
      />
    </>
  );
}
export function MaintenanceDetailView({
  data,
  permissions,
  methods,
  timezone,
}: {
  data: MaintenanceDetailData;
  permissions: string[];
  methods: { id: string; name: string }[];
  timezone: string;
}) {
  const m = data.record,
    closed = ["COMPLETED", "CANCELLED"].includes(m.status),
    canExpense =
      permissions.includes("expenses.write") &&
      permissions.includes("finance.read");
  return (
    <div className="maintenance-detail">
      <BackLink href="/admin/manutencao">Voltar para manutenção</BackLink>
      <WorkspaceHeading
        title={`${kindLabel(m.kind)} · ${m.id.slice(0, 8)}`}
        description={m.description}
        action={
          <RecordStatus attention={m.status === "IN_PROGRESS"}>
            {statusLabel(m.status)}
          </RecordStatus>
        }
      />
      <dl className="reservation-period">
        <div>
          <dt>Início previsto</dt>
          <dd>{businessDate(m.start_at, timezone)}</dd>
        </div>
        <div>
          <dt>Fim previsto</dt>
          <dd>{businessDate(m.end_at, timezone)}</dd>
        </div>
        <div>
          <dt>Disponibilidade</dt>
          <dd>
            {m.blocks_availability
              ? "Com bloqueio no período"
              : "Sem bloqueio no período"}
          </dd>
        </div>
      </dl>
      <p className="field-help">
        Horários no fuso {timezone}. A conclusão e a liberação seguem as regras
        da operação.
      </p>
      <div className="rental-related">
        {permissions.includes("vehicles.read") && (
          <Link className="text-link" href={`/admin/frota/${m.vehicle_id}`}>
            Abrir veículo
          </Link>
        )}
      </div>
      <details className="record-reference">
        <summary>Referências do serviço</summary>
        <p>
          {m.id} · versão {m.version} · veículo {m.vehicle_id}
        </p>
      </details>
      <section className="business-section">
        <h2>Acompanhamento do serviço</h2>
        <dl className="rental-facts">
          <div>
            <dt>Quilometragem informada</dt>
            <dd>{m.mileage} km</dd>
          </div>
          <div>
            <dt>Próxima manutenção por data</dt>
            <dd>
              {m.next_due_on
                ? businessDate(m.next_due_on, timezone)
                : "Não definida"}
            </dd>
          </div>
          <div>
            <dt>Próxima manutenção por km</dt>
            <dd>{m.next_due_mileage ?? "Não definida"}</dd>
          </div>
          {m.actual_start_at && (
            <div>
              <dt>Iniciada em</dt>
              <dd>{businessDate(m.actual_start_at, timezone)}</dd>
            </div>
          )}
          {m.actual_end_at && (
            <div>
              <dt>Concluída em</dt>
              <dd>{businessDate(m.actual_end_at, timezone)}</dd>
            </div>
          )}
        </dl>
      </section>
      <section className="business-section">
        <h2>Operações deste serviço</h2>
        {closed ? (
          <p className="field-help">
            Serviço encerrado. O histórico permanece disponível e não pode ser
            reaberto por esta tela.
          </p>
        ) : permissions.includes("maintenance.write") ? (
          <MaintenanceWorkflow
            m={m}
            methods={methods}
            canExpense={canExpense}
            timezone={timezone}
          />
        ) : (
          <p className="field-help">
            Consulta sem permissão para alterar este serviço.
          </p>
        )}
      </section>
      <section className="business-section">
        <h2>Histórico</h2>
        {!data.events.length ? (
          <p className="field-help">Nenhum evento disponível.</p>
        ) : (
          <ol className="record-history">
            {data.events.map((e) => (
              <li key={e.id}>
                <time dateTime={e.created_at}>
                  {businessDate(e.created_at, timezone)}
                </time>
                <div>
                  <strong>
                    {(
                      {
                        CREATE: "Agendamento",
                        START: "Início",
                        COMPLETE: "Conclusão",
                        CANCEL: "Cancelamento",
                        RESCHEDULE: "Reagendamento",
                        EXTEND: "Extensão",
                      } as Record<string, string>
                    )[e.event_type] ?? e.event_type}
                  </strong>
                  {typeof e.detail.reason === "string" && (
                    <p>{e.detail.reason}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
