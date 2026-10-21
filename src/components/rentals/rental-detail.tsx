import Link from "next/link";
import {
  BackLink,
  WorkspaceHeading,
  RecordStatus,
} from "@/components/business/workspace";
import { bookingDate } from "@/lib/reservations/labels";
import { rentalLabels, operationalPolicySchema } from "@/lib/rentals/schema";
import { rentalMoney } from "@/lib/rentals/presentation";
import type { getRental } from "@/lib/rentals/service";
import {
  RentalWorkflow,
  InspectionPanel,
  RetryContract,
  AssessDamage,
} from "./rental-workflow";
import { JobsButton, FileButton } from "./operation-form";
import { ExtensionForm } from "./extension-form";

export type RentalDetailData = Awaited<ReturnType<typeof getRental>>;
const events: Record<string, string> = {
  CREATED: "Locação criada",
  DRIVERS: "Condutores vinculados",
  INSPECTION: "Vistoria aberta",
  ITEMS: "Vistoria preenchida",
  COMPLETE_INSPECTION: "Vistoria concluída",
  CONTRACT: "Contrato solicitado",
  RETRY_CONTRACT: "Contrato reagendado",
  CHECKOUT: "Retirada confirmada",
  CHECKIN: "Devolução confirmada",
  CANCEL: "Locação cancelada",
  LOGISTICS: "Logística executada",
  EXTENDED: "Locação prorrogada",
  OVERDUE: "Atraso identificado",
  RETURN_AWAITING_PAYMENT: "Devolução aguardando quitação",
};
export function RentalDetail({
  detail,
  permissions,
  plans,
}: {
  detail: RentalDetailData;
  permissions: string[];
  plans: { id: string; name: string }[];
}) {
  const { rental: r, inspections, contracts, drivers, overdue } = detail,
    can = (p: string) => permissions.includes(p),
    policy = operationalPolicySchema.safeParse(
      r.commercial_snapshot.operations,
    ),
    open = ["PREPARING", "ACTIVE", "OVERDUE"].includes(r.status),
    editable =
      open &&
      [
        "rentals.create",
        "inspections.write",
        "contracts.generate",
        "rentals.checkout",
        "rentals.checkin",
      ].some(can);
  return (
    <div className="rental-detail">
      <BackLink href="/admin/locacoes">Voltar para locações</BackLink>
      <WorkspaceHeading
        title={`Locação ${r.id.slice(0, 8)}`}
        description="Consulte a operação, as vistorias e os documentos desta locação."
        action={
          <RecordStatus attention={overdue || r.status === "OVERDUE"}>
            {overdue ? "Atrasada" : (rentalLabels[r.status] ?? r.status)}
          </RecordStatus>
        }
      />
      <dl className="reservation-period">
        <div>
          <dt>Retirada prevista</dt>
          <dd>
            <time dateTime={r.start_at}>{bookingDate(r.start_at)}</time>
          </dd>
        </div>
        <div>
          <dt>Devolução prevista</dt>
          <dd>
            <time dateTime={r.end_at}>{bookingDate(r.end_at)}</time>
          </dd>
        </div>
        <div>
          <dt>Registro da operação</dt>
          <dd>
            {r.actual_end_at
              ? "Devolução confirmada"
              : r.actual_start_at
                ? "Retirada confirmada"
                : "Retirada não confirmada"}
          </dd>
        </div>
      </dl>
      <p className="field-help">Horários no fuso de Fortaleza.</p>
      <div className="rental-related">
        {can("customers.read") && (
          <Link className="text-link" href={`/admin/clientes/${r.customer_id}`}>
            Abrir cliente
          </Link>
        )}
        {can("vehicles.read") && (
          <Link className="text-link" href={`/admin/frota/${r.vehicle_id}`}>
            Abrir veículo
          </Link>
        )}
        {r.reservation_id && can("reservations.read") && (
          <Link
            className="text-link"
            href={`/admin/reservas/${r.reservation_id}`}
          >
            Reserva de origem
          </Link>
        )}
      </div>
      <details className="record-reference">
        <summary>Referências da locação</summary>
        <p>
          {r.id} · versão {r.version}
        </p>
      </details>
      {overdue && (
        <aside className="rental-overdue" role="alert">
          <h2>Veículo ainda não devolvido</h2>
          <p>
            Novas retiradas estão bloqueadas para este veículo. Trate as
            próximas reservas com a operação; a faixa de ocupação não é ampliada
            automaticamente.
          </p>
          {can("reservations.read") &&
            detail.nextReservations.map(
              (a, index) =>
                a.reservation_id && (
                  <Link
                    key={`${a.reservation_id}-${index}`}
                    className="text-link"
                    href={`/admin/reservas/${a.reservation_id}`}
                  >
                    Reserva afetada {String(a.reservation_id).slice(0, 8)}
                  </Link>
                ),
            )}
        </aside>
      )}
      <nav className="rental-sections" aria-label="Seções da locação">
        {[
          ["operacao", "Operação"],
          ["logistica", "Logística"],
          ["vistorias", "Vistorias"],
          ["contratos", "Contratos"],
          ["avarias", "Avarias"],
          ["historico", "Histórico"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>
      <section
        id="operacao"
        className="rental-section"
        aria-labelledby="operacao-title"
      >
        <h2 id="operacao-title">Operação da locação</h2>
        {!editable && (
          <p className="field-help">
            {open
              ? "Consulta conforme as permissões do seu perfil. As ações exigem autorização específica."
              : "Operação encerrada. Consulte os registros e documentos abaixo."}
          </p>
        )}
        {(r.actual_start_at || r.actual_end_at) && (
          <dl className="rental-facts">
            {r.actual_start_at && (
              <div>
                <dt>Retirada confirmada em</dt>
                <dd>{bookingDate(r.actual_start_at)}</dd>
              </div>
            )}
            {r.actual_end_at && (
              <div>
                <dt>Devolução confirmada em</dt>
                <dd>{bookingDate(r.actual_end_at)}</dd>
              </div>
            )}
          </dl>
        )}
        <div className="rental-drivers">
          <h3>Condutores vinculados</h3>
          {r.rental_drivers.length ? (
            <ul>
              {r.rental_drivers.map((d) => (
                <li key={d.driver_id}>
                  {can("drivers.read") ? (
                    <Link
                      className="text-link"
                      href={`/admin/condutores/${d.driver_id}`}
                    >
                      {typeof d.driver_snapshot.name === "string"
                        ? d.driver_snapshot.name
                        : "Abrir condutor vinculado"}
                    </Link>
                  ) : (
                    "Condutor vinculado"
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="field-help">
              Nenhum condutor vinculado a esta locação.
            </p>
          )}
        </div>
        {policy.success && (
          <details className="rental-disclosure">
            <summary>Condições congeladas na contratação</summary>
            <div className="rental-disclosure-body">
              <dl className="rental-facts">
                <div>
                  <dt>Recebimento para retirada</dt>
                  <dd>
                    {policy.data.checkout_payment === "FULL"
                      ? "Quitação confirmada exigida"
                      : "Recebimento prévio dispensado"}
                  </dd>
                </div>
                <div>
                  <dt>Caução</dt>
                  <dd>
                    {policy.data.require_deposit
                      ? "Exigida"
                      : "Prévia dispensada"}
                  </dd>
                </div>
                <div>
                  <dt>Documentos</dt>
                  <dd>
                    {policy.data.require_documents ? "Exigidos" : "Opcionais"}
                  </dd>
                </div>
                <div>
                  <dt>Fechamento</dt>
                  <dd>
                    {policy.data.checkin_balance === "SETTLED"
                      ? "Exige quitação"
                      : "Permite saldo a receber"}
                  </dd>
                </div>
              </dl>
              <p className="field-help">
                Estas são exigências contratuais, não uma confirmação de
                pagamento. Consulte o contrato para preços e regras completos.
              </p>
            </div>
          </details>
        )}
        <RentalWorkflow r={r} drivers={drivers} permissions={permissions} />
      </section>
      <section
        id="logistica"
        className="rental-section"
        aria-labelledby="logistica-title"
      >
        <h2 id="logistica-title">Logística</h2>
        {!r.rental_locations.length && (
          <p className="field-help">Nenhum registro de logística disponível.</p>
        )}
        <div className="rental-logistics">
          {r.rental_locations.map((l) => (
            <article key={l.id}>
              <div className="rental-row-heading">
                <h3>{l.direction === "PICKUP" ? "Retirada" : "Devolução"}</h3>
                <RecordStatus>
                  {l.performed_at ? "Executada" : "Pendente"}
                </RecordStatus>
              </div>
              <p>
                {l.mode === "BRANCH"
                  ? "Na unidade"
                  : l.mode === "DELIVERY"
                    ? "Entrega"
                    : "Coleta"}
              </p>
              <dl className="rental-facts">
                <div>
                  <dt>Prevista para</dt>
                  <dd>{bookingDate(l.scheduled_at)}</dd>
                </div>
                <div>
                  <dt>Taxa contratada</dt>
                  <dd>{rentalMoney(l.fee)}</dd>
                </div>
              </dl>
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
              {l.performed_at && (
                <p className="field-help">
                  Executada em {bookingDate(l.performed_at)}
                  {l.notes ? ` · ${l.notes}` : ""}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>
      <section
        id="vistorias"
        className="rental-section"
        aria-labelledby="vistorias-title"
      >
        <h2 id="vistorias-title">Vistorias e evidências</h2>
        {!can("inspections.read") ? (
          <p className="field-help">
            Seu perfil não permite consultar as vistorias.
          </p>
        ) : inspections.length ? (
          inspections.map((i) => (
            <InspectionPanel
              key={i.id}
              i={i}
              r={r}
              canWrite={can("inspections.write")}
            />
          ))
        ) : (
          <p className="field-help">
            Nenhuma vistoria registrada. A abertura fica na seção Operação,
            conforme sua permissão e a etapa da locação.
          </p>
        )}
      </section>
      <section
        id="contratos"
        className="rental-section"
        aria-labelledby="contratos-title"
      >
        <h2 id="contratos-title">Contratos e aditivos em PDF</h2>
        <p className="field-help">
          Consulte a versão e a situação de geração. O acesso ao arquivo usa um
          link temporário autorizado.
        </p>
        {can("contracts.generate") && <JobsButton />}
        {!can("contracts.read") ? (
          <p className="field-help">
            Seu perfil não permite consultar os contratos.
          </p>
        ) : !contracts.length ? (
          <p className="field-help">
            Nenhum contrato registrado. Solicite a geração na seção Operação
            quando os dados estiverem prontos.
          </p>
        ) : (
          contracts.map((c) => (
            <article className="rental-contract" key={c.id}>
              <div className="rental-row-heading">
                <h3>Versão {c.version}</h3>
                <RecordStatus attention={c.generation_status === "FAILED"}>
                  {c.generation_status === "GENERATED"
                    ? "Gerado"
                    : c.generation_status === "FAILED"
                      ? "Falha de geração"
                      : "Na fila"}
                </RecordStatus>
              </div>
              <p className="field-help">
                {bookingDate(c.created_at)} · {c.attempts} tentativa(s)
              </p>
              {c.generation_status === "GENERATED" && (
                <FileButton
                  id={c.id}
                  kind="contract"
                  label={`Abrir contrato · versão ${c.version}`}
                />
              )}
              {c.generation_status === "FAILED" && (
                <p>
                  Não foi possível gerar este PDF.{" "}
                  {can("contracts.generate")
                    ? "Reagende a geração enquanto a locação estiver aberta."
                    : "Peça à equipe autorizada para verificar a geração."}
                </p>
              )}
              {c.sha256 && (
                <details className="record-reference">
                  <summary>Integridade do arquivo</summary>
                  <p>SHA-256: {c.sha256}</p>
                </details>
              )}
              {c.generation_status === "FAILED" &&
                can("contracts.generate") &&
                !["COMPLETED", "CANCELLED"].includes(r.status) && (
                  <RetryContract r={r} id={c.id} />
                )}
            </article>
          ))
        )}
      </section>
      <section
        id="avarias"
        className="rental-section"
        aria-labelledby="avarias-title"
      >
        <h2 id="avarias-title">Avarias da devolução</h2>
        {!can("inspections.read") ? (
          <p className="field-help">
            A consulta de avarias depende do acesso às vistorias.
          </p>
        ) : !detail.damages.length ? (
          <p className="field-help">Nenhuma avaria registrada.</p>
        ) : (
          detail.damages.map((d) => (
            <article className="rental-damage" key={d.id}>
              <p>{d.description}</p>
              <RecordStatus attention={d.status === "OPEN"}>
                {d.status === "OPEN"
                  ? "Aguardando avaliação"
                  : d.status === "ASSESSED"
                    ? "Avaliada com cobrança"
                    : "Sem cobrança"}
              </RecordStatus>
              {d.status === "OPEN" &&
                can("charges.create") &&
                !r.commercial_snapshot.closing && (
                  <AssessDamage r={r} id={d.id} />
                )}
            </article>
          ))
        )}
      </section>
      {plans.length > 0 && !r.commercial_snapshot.closing && (
        <ExtensionForm r={r} plans={plans} />
      )}
      {r.rental_extensions.length > 0 && (
        <section className="rental-section">
          <h2>Prorrogações registradas</h2>
          <ul className="record-history">
            {r.rental_extensions.map((e) => (
              <li key={e.id}>
                <span>
                  De {bookingDate(e.previous_end_at)} para{" "}
                  {bookingDate(e.new_end_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section
        id="historico"
        className="rental-section"
        aria-labelledby="historico-title"
      >
        <h2 id="historico-title">Histórico recente</h2>
        {!detail.events.length ? (
          <p className="field-help">Nenhum evento disponível.</p>
        ) : (
          <ol className="record-history">
            {detail.events.map((e) => (
              <li key={e.id}>
                <time dateTime={e.created_at}>{bookingDate(e.created_at)}</time>
                <div>
                  <strong>{events[e.event_type] ?? e.event_type}</strong>
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
