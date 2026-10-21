import Link from "next/link";
import {
  BackLink,
  RecordStatus,
  WorkspaceHeading,
} from "@/components/business/workspace";
import { bookingDate, statusLabels } from "@/lib/reservations/labels";
import type { getReservation, QuoteView } from "@/lib/reservations/service";
import { QuoteSummary } from "./quote-summary";
export type ReservationDetailData = Awaited<ReturnType<typeof getReservation>>;
const declaredLabels: Record<string, string> = {
  name: "Nome",
  person_type: "Tipo de pessoa",
  tax_document: "CPF / CNPJ",
  email: "E-mail",
  phone: "Telefone",
  birth_date: "Nascimento",
  address: "Endereço",
  postal_code: "CEP",
  street: "Logradouro",
  number: "Número",
  complement: "Complemento",
  district: "Bairro",
  city: "Cidade",
  state: "UF",
};
function DeclaredValues({ value }: { value: Record<string, unknown> }) {
  return (
    <dl className="declared-values">
      {Object.entries(value).map(([key, item]) => (
        <div key={key}>
          <dt>{declaredLabels[key] ?? key.replaceAll("_", " ")}</dt>
          <dd>
            {item && typeof item === "object" && !Array.isArray(item) ? (
              <DeclaredValues value={item as Record<string, unknown>} />
            ) : item === null || item === "" ? (
              "Não informado"
            ) : (
              String(item)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function ReservationDetail({
  reservation: r,
  quote,
  permissions,
  decision,
  conversion,
}: {
  reservation: ReservationDetailData;
  quote: QuoteView | null;
  permissions: readonly string[];
  decision?: React.ReactNode;
  conversion?: React.ReactNode;
}) {
  return (
    <div className="reservation-detail">
      <BackLink href="/admin/reservas">Voltar para reservas</BackLink>
      <WorkspaceHeading
        title={`Reserva ${r.id.slice(0, 8)}`}
        description="Consulte o período, os valores e os próximos passos desta solicitação."
        action={
          <RecordStatus
            attention={["REQUESTED", "UNDER_REVIEW"].includes(r.status)}
          >
            {statusLabels[r.status]}
          </RecordStatus>
        }
      />
      <dl className="reservation-period">
        <div>
          <dt>Retirada</dt>
          <dd>
            <time dateTime={r.start_at}>{bookingDate(r.start_at)}</time>
          </dd>
        </div>
        <div>
          <dt>Devolução</dt>
          <dd>
            <time dateTime={r.end_at}>{bookingDate(r.end_at)}</time>
          </dd>
        </div>
        {r.expires_at && (
          <div>
            <dt>Prazo de análise</dt>
            <dd>
              <time dateTime={r.expires_at}>{bookingDate(r.expires_at)}</time>
            </dd>
          </div>
        )}
      </dl>
      <p className="field-help">Horários no fuso de Fortaleza.</p>
      <details className="record-reference">
        <summary>Referências da reserva</summary>
        <p>
          Reserva: {r.id} · versão {r.version}
        </p>
      </details>
      <div className="reservation-links">
        {permissions.includes("customers.read") && (
          <Link className="text-link" href={`/admin/clientes/${r.customer_id}`}>
            Abrir cliente
          </Link>
        )}
        {r.vehicle_allocations
          .filter((a) => !a.released_at)
          .map((a) => (
            <Link
              key={a.vehicle_id}
              className="text-link"
              href={`/admin/frota/${a.vehicle_id}`}
            >
              Veículo atribuído · {a.vehicle_id}
            </Link>
          ))}
        {r.status === "CONVERTED" && permissions.includes("rentals.read") && (
          <Link className="text-link" href="/admin/locacoes">
            Ver locações
          </Link>
        )}
      </div>
      <div className="reservation-detail-grid">
        <div>
          {quote && <QuoteSummary quote={quote} />}
          <section className="workspace-section">
            <h2>Retirada e devolução</h2>
            <p className="field-help">
              Dados de logística registrados no momento da reserva.
            </p>
            <div className="location-list">
              {r.reservation_locations.map((l) => (
                <article key={l.direction}>
                  <h3>{l.direction === "PICKUP" ? "Retirada" : "Devolução"}</h3>
                  <p>
                    {l.mode === "BRANCH"
                      ? "Na unidade"
                      : l.mode === "DELIVERY"
                        ? "Entrega"
                        : "Coleta"}{" "}
                    · {bookingDate(l.scheduled_at)}
                  </p>
                  <p>
                    {[
                      "street",
                      "number",
                      "complement",
                      "district",
                      "city",
                      "state",
                      "postal_code",
                    ]
                      .map((k) => l.address_snapshot[k])
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {l.instructions && <p>{l.instructions}</p>}
                </article>
              ))}
            </div>
          </section>
        </div>
        <div>
          {conversion}
          {decision}
          <section className="workspace-section">
            <h2>Histórico da reserva</h2>
            {!r.reservation_status_history.length ? (
              <p className="field-help">Nenhuma movimentação registrada.</p>
            ) : (
              <ol className="reservation-history">
                {[...r.reservation_status_history]
                  .sort(
                    (a, b) =>
                      a.created_at.localeCompare(b.created_at) ||
                      a.id.localeCompare(b.id),
                  )
                  .map((h) => (
                    <li key={h.id}>
                      <time dateTime={h.created_at}>
                        {bookingDate(h.created_at)}
                      </time>
                      <p>
                        {h.from_status
                          ? `${statusLabels[h.from_status]} → `
                          : ""}
                        <strong>{statusLabels[h.to_status]}</strong>
                      </p>
                      {h.reason && <p className="field-help">{h.reason}</p>}
                    </li>
                  ))}
              </ol>
            )}
          </section>
        </div>
      </div>
      {r.submission && (
        <section className="workspace-section">
          <h2>Dados declarados na solicitação pública</h2>
          <p className="field-help">
            Conferir identidade e documentos antes da aprovação/retirada. Os
            dados abaixo não substituem o cadastro existente.
          </p>
          <DeclaredValues
            value={r.submission.customer_data as Record<string, unknown>}
          />
          <p className="field-help">
            Aceite em {bookingDate(String(r.submission.accepted_at))} · versão{" "}
            {String(r.submission.terms_version)}
          </p>
        </section>
      )}
    </div>
  );
}
