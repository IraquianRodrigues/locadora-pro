import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WorkspaceHeading,
  RecordStatus,
  RecordPagination,
  EmptyRecords,
} from "@/components/business/workspace";
import { reservationStatuses } from "@/lib/reservations/schema";
import { bookingDate, statusLabels } from "@/lib/reservations/labels";
import type { listReservations } from "@/lib/reservations/service";
export type ReservationListData = Awaited<ReturnType<typeof listReservations>>;
export function ReservationList({
  data,
  meta,
  status,
  canRequest,
  expiry,
}: ReservationListData & {
  status: string;
  canRequest: boolean;
  expiry?: React.ReactNode;
}) {
  return (
    <>
      <WorkspaceHeading
        title="Reservas"
        description="Acompanhe solicitações, análise e confirmação das reservas."
        action={
          canRequest ? (
            <Button asChild>
              <Link href="/admin/reservas/nova">
                <Plus aria-hidden="true" />
                Nova cotação e reserva
              </Link>
            </Button>
          ) : undefined
        }
      />
      <form className="records-filter" method="get">
        <label>
          Situação
          <select name="status" defaultValue={status}>
            <option value="">Todas</option>
            {reservationStatuses.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          Aplicar filtros
        </Button>
        <Link className="records-clear" href="/admin/reservas">
          Limpar
        </Link>
      </form>
      <div className="records-context">
        <p>{meta.total} reserva(s). Horários exibidos no fuso de Fortaleza.</p>
      </div>
      {!data.length ? (
        <EmptyRecords title="Nenhuma reserva encontrada">
          Revise a situação selecionada ou inicie uma cotação para solicitar uma
          reserva.
          <Link className="text-link" href="/admin/reservas">
            Limpar filtros
          </Link>
        </EmptyRecords>
      ) : (
        <table className="records-table reservation-table">
          <caption className="sr-only">
            Reservas · resultados da consulta
          </caption>
          <thead>
            <tr>
              <th scope="col">Reserva</th>
              <th scope="col">Retirada / devolução</th>
              <th scope="col">Situação</th>
              <th scope="col">Prazo de análise</th>
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
                    href={`/admin/reservas/${r.id}`}
                  >
                    Reserva {r.id.slice(0, 8)}
                  </Link>
                </th>
                <td data-label="Retirada / devolução">
                  <time dateTime={r.start_at}>{bookingDate(r.start_at)}</time>
                  <small>
                    até <time dateTime={r.end_at}>{bookingDate(r.end_at)}</time>
                  </small>
                </td>
                <td data-label="Situação">
                  <RecordStatus
                    attention={["REQUESTED", "UNDER_REVIEW"].includes(r.status)}
                  >
                    {statusLabels[r.status]}
                  </RecordStatus>
                </td>
                <td data-label="Prazo de análise">
                  {r.expires_at &&
                  ["REQUESTED", "UNDER_REVIEW"].includes(r.status) ? (
                    <time dateTime={r.expires_at}>
                      {bookingDate(r.expires_at)}
                    </time>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="record-open">
                  <Link
                    href={`/admin/reservas/${r.id}`}
                    aria-label={`Abrir reserva ${r.id.slice(0, 8)}`}
                  >
                    Abrir
                    <ArrowUpRight aria-hidden="true" size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <RecordPagination
        {...meta}
        href={(p) => `/admin/reservas?page=${p}&status=${status}`}
        label="Paginação de reservas"
      />
      {expiry && (
        <div className="reservation-maintenance">
          {expiry}
          <p className="field-help">
            Registra a expiração das solicitações cujo prazo de análise
            terminou.
          </p>
        </div>
      )}
    </>
  );
}
