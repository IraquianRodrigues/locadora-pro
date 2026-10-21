import Link from "next/link";
import { ArrowUpRight, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WorkspaceHeading,
  RecordStatus,
  RecordPagination,
  EmptyRecords,
} from "@/components/business/workspace";
import { rentalLabels } from "@/lib/rentals/schema";
import { bookingDate } from "@/lib/reservations/labels";
import type { listRentals } from "@/lib/rentals/service";

export type RentalListData = Awaited<ReturnType<typeof listRentals>>;
export function RentalList({
  data,
  page,
  total,
  status,
  permissions,
  jobs,
}: RentalListData & {
  status: string;
  permissions: string[];
  jobs?: React.ReactNode;
}) {
  return (
    <>
      <WorkspaceHeading
        title="Locações"
        description="Acompanhe a preparação, a retirada e a devolução dos veículos."
        action={
          permissions.includes("rentals.create") ? (
            <Button asChild>
              <Link href="/admin/locacoes/nova">
                <Plus aria-hidden="true" />
                Nova locação direta
              </Link>
            </Button>
          ) : undefined
        }
      />
      {permissions.includes("settings.manage") && (
        <div className="rental-settings-link">
          <Link className="text-link" href="/admin/locacoes/configuracao">
            <Settings2 size={16} aria-hidden="true" />
            Regras e modelos
          </Link>
        </div>
      )}
      <form className="records-filter" method="get">
        <label>
          Situação
          <select name="status" defaultValue={status}>
            <option value="">Todas</option>
            {Object.entries(rentalLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          Aplicar filtros
        </Button>
        <Link className="records-clear" href="/admin/locacoes">
          Limpar
        </Link>
      </form>
      <div className="records-context">
        <p>{total} locação(ões). Horários exibidos no fuso de Fortaleza.</p>
      </div>
      {!data.length ? (
        <EmptyRecords title="Nenhuma locação encontrada">
          Revise a situação selecionada ou crie uma locação direta, se tiver
          permissão.
          <Link className="text-link" href="/admin/locacoes">
            Limpar filtros
          </Link>
        </EmptyRecords>
      ) : (
        <table className="records-table rental-table">
          <caption className="sr-only">
            Locações · resultados da consulta
          </caption>
          <thead>
            <tr>
              <th scope="col">Locação</th>
              <th scope="col">Retirada / devolução</th>
              <th scope="col">Situação</th>
              <th scope="col">Etapa da operação</th>
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <th scope="row">
                  <Link
                    className="record-name"
                    href={`/admin/locacoes/${r.id}`}
                  >
                    Locação {r.id.slice(0, 8)}
                  </Link>
                </th>
                <td data-label="Retirada / devolução">
                  <time dateTime={r.start_at}>{bookingDate(r.start_at)}</time>
                  <small>
                    até <time dateTime={r.end_at}>{bookingDate(r.end_at)}</time>
                  </small>
                </td>
                <td data-label="Situação">
                  <RecordStatus attention={r.overdue || r.status === "OVERDUE"}>
                    {r.overdue
                      ? "Atrasada"
                      : (rentalLabels[r.status] ?? r.status)}
                  </RecordStatus>
                </td>
                <td data-label="Etapa da operação">
                  {r.overdue || r.status === "OVERDUE"
                    ? "Verificar devolução e próximas reservas"
                    : r.status === "PREPARING"
                      ? "Preparação da retirada"
                      : r.status === "ACTIVE"
                        ? "Veículo em uso"
                        : r.status === "COMPLETED"
                          ? "Consultar fechamento"
                          : "Consultar registro"}
                </td>
                <td className="record-open">
                  <Link
                    href={`/admin/locacoes/${r.id}`}
                    aria-label={`Abrir locação ${r.id.slice(0, 8)}`}
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
        page={page}
        total={total}
        pageSize={20}
        href={(p) => `/admin/locacoes?page=${p}&status=${status}`}
        label="Paginação de locações"
      />
      {jobs && (
        <div className="reservation-maintenance">
          {jobs}
          <p className="field-help">
            Processa os PDFs na fila e verifica os atrasos. Não confirma
            retirada ou devolução.
          </p>
        </div>
      )}
    </>
  );
}
