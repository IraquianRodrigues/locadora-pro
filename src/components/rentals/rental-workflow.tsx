"use client";
import type { RentalView, InspectionView } from "@/lib/rentals/service";
import {
  OperationForm,
  control,
  PhotoUpload,
  FileButton,
} from "./operation-form";
export function RentalWorkflow({
  r,
  drivers,
  permissions,
}: {
  r: RentalView;
  drivers: {
    id: string;
    name: string;
    license_category: string;
    license_expires_on: string;
  }[];
  permissions: string[];
}) {
  const base = { rental_id: r.id, expected_version: r.version },
    can = (p: string) => permissions.includes(p),
    preparing = r.status === "PREPARING",
    active = ["ACTIVE", "OVERDUE"].includes(r.status);
  if (!preparing && !active) return null;
  return (
    <div>
      {preparing && can("rentals.create") && (
        <OperationForm
          collapsible
          title="Vincular condutores"
          build={(f) => ({
            ...base,
            action: "DRIVERS",
            driver_ids: f.getAll("drivers"),
          })}
        >
          <p>
            Somente condutores do cliente, com categoria permitida e CNH válida
            até o fim do período.
          </p>
          {drivers.map((d) => (
            <label key={d.id} className="field-label">
              <input
                type="checkbox"
                name="drivers"
                value={d.id}
                defaultChecked={r.rental_drivers.some(
                  (rd) => rd.driver_id === d.id,
                )}
              />{" "}
              {d.name} · {d.license_category} · validade {d.license_expires_on}
            </label>
          ))}
          {!drivers.length && (
            <p>Cadastre um condutor para este cliente antes de continuar.</p>
          )}
        </OperationForm>
      )}
      {can("inspections.write") && !r.commercial_snapshot.closing && (
        <OperationForm
          collapsible
          title={preparing ? "Abrir vistoria inicial" : "Abrir vistoria final"}
          build={(f) => ({
            ...base,
            action: "INSPECTION",
            kind: preparing ? "INITIAL" : "FINAL",
            mileage: Number(f.get("mileage")),
            fuel: Number(f.get("fuel")),
            notes: String(f.get("notes")),
          })}
        >
          <div className="form-grid">
            <label>
              Quilometragem
              <input
                className={control}
                name="mileage"
                type="number"
                min={r.initial_mileage ?? 0}
                max={99999999}
                required
              />
            </label>
            <label>
              Combustível (%)
              <input
                className={control}
                name="fuel"
                type="number"
                min={0}
                max={100}
                step="0.01"
                required
              />
            </label>
          </div>
          <label className="field-label">
            Observações
            <textarea className={control} name="notes" maxLength={1000} />
          </label>
        </OperationForm>
      )}
      {preparing && can("contracts.generate") && (
        <OperationForm
          collapsible
          title="Solicitar contrato em PDF"
          build={() => ({ ...base, action: "CONTRACT" })}
        >
          <p>
            Conclua a vistoria inicial e vincule os condutores. O PDF usará o
            modelo aprovado e os dados atuais, congelados nesta versão.
          </p>
        </OperationForm>
      )}
      {r.rental_locations.map(
        (l) =>
          !l.performed_at &&
          can("rentals.create") && (
            <OperationForm
              collapsible
              key={l.id}
              title={
                l.direction === "PICKUP"
                  ? "Registrar execução da retirada"
                  : "Registrar execução da devolução"
              }
              build={(f) => ({
                ...base,
                action: "LOGISTICS",
                direction: l.direction,
                notes: String(f.get("notes")),
              })}
            >
              <p>
                Registre após realizar a entrega, coleta ou atendimento na
                unidade. O horário e o responsável serão registrados pelo
                servidor.
              </p>
              <label className="field-label">
                Comprovante ou observação
                <textarea
                  className={control}
                  name="notes"
                  minLength={5}
                  maxLength={1000}
                  required
                />
              </label>
            </OperationForm>
          ),
      )}
      {preparing && can("rentals.checkout") && (
        <OperationForm
          collapsible
          title="Confirmar retirada"
          build={() => ({ ...base, action: "CHECKOUT" })}
        >
          <p>
            Exige condutores válidos, vistoria inicial concluída, contrato atual
            gerado e logística executada. Recebimento e caução seguem a política
            contratada.
          </p>
        </OperationForm>
      )}
      {active && can("rentals.checkin") && (
        <OperationForm
          collapsible
          title="Apurar e confirmar devolução"
          build={() => ({ ...base, action: "CHECKIN" })}
        >
          <p>
            Conclua a vistoria final e registre a logística. Os excedentes serão
            apurados uma única vez conforme o contrato. Se for exigida
            liquidação, o veículo permanece alocado até o financeiro confirmar e
            a devolução ser confirmada novamente.
          </p>
        </OperationForm>
      )}
      {preparing && can("rentals.create") && (
        <OperationForm
          collapsible
          title="Cancelar locação"
          build={(f) => ({
            ...base,
            action: "CANCEL",
            reason: String(f.get("reason")),
          })}
        >
          <p>
            Recebimentos ou cauções existentes devem ser tratados pelo
            financeiro antes de cancelar.
          </p>
          <label className="field-label">
            Motivo
            <textarea
              className={control}
              name="reason"
              minLength={5}
              maxLength={1000}
              required
            />
          </label>
        </OperationForm>
      )}
    </div>
  );
}
export function InspectionPanel({
  i,
  r,
  canWrite,
}: {
  i: InspectionView;
  r: RentalView;
  canWrite: boolean;
}) {
  const base = { rental_id: r.id, expected_version: r.version },
    editable =
      canWrite &&
      !i.completed_at &&
      !r.commercial_snapshot.closing &&
      ((i.kind === "INITIAL" && r.status === "PREPARING") ||
        (i.kind === "FINAL" && ["ACTIVE", "OVERDUE"].includes(r.status)));
  return (
    <section className="rental-inspection">
      <h3 className="rental-inspection-title">
        Vistoria {i.kind === "INITIAL" ? "inicial" : "final"} ·{" "}
        {i.completed_at ? "Concluída e imutável" : "Em preenchimento"}
      </h3>
      <p className="mt-2">
        {i.mileage} km · combustível {i.fuel}%
      </p>
      {i.notes && <p>{i.notes}</p>}
      {editable ? (
        <OperationForm
          title="Salvar respostas da vistoria"
          build={(f) => ({
            ...base,
            action: "ITEMS",
            inspection_id: i.id,
            items: i.checklist_snapshot.map((x) => ({
              key: x.key,
              condition: String(f.get(`${x.key}_condition`)),
              notes: String(f.get(`${x.key}_notes`)),
            })),
          })}
        >
          {i.checklist_snapshot.map((x) => {
            const current = i.inspection_items.find(
              (a) => a.item_key === x.key,
            );
            return (
              <fieldset key={x.key} className="rental-checklist-item">
                <legend>
                  {x.label}
                  {x.photo_required ? " · foto obrigatória" : ""}
                </legend>
                <label className="field-label">
                  Condição
                  <select
                    className={control}
                    name={`${x.key}_condition`}
                    defaultValue={current?.condition ?? "OK"}
                  >
                    <option value="OK">OK</option>
                    <option value="DAMAGE">Avariado</option>
                    <option value="MISSING">Ausente</option>
                    <option value="NOT_APPLICABLE">Não se aplica</option>
                  </select>
                </label>
                <label className="field-label">
                  Descrição
                  <textarea
                    className={control}
                    name={`${x.key}_notes`}
                    maxLength={1000}
                    defaultValue={current?.notes ?? ""}
                  />
                </label>
              </fieldset>
            );
          })}
        </OperationForm>
      ) : (
        i.checklist_snapshot.map((x) => {
          const current = i.inspection_items.find((a) => a.item_key === x.key);
          return (
            <p key={x.key} className="my-3">
              {x.label}:{" "}
              {(
                {
                  OK: "OK",
                  DAMAGE: "Avariado",
                  MISSING: "Ausente",
                  NOT_APPLICABLE: "Não se aplica",
                } as Record<string, string>
              )[current?.condition ?? ""] ?? "Sem resposta"}{" "}
              · {current?.notes}
            </p>
          );
        })
      )}
      {i.inspection_items.map((item) => (
        <div key={item.id} className="rental-evidence">
          <h4 className="rental-evidence-title">
            Fotos:{" "}
            {i.checklist_snapshot.find((x) => x.key === item.item_key)?.label ??
              item.item_key}
          </h4>
          {i.inspection_photos
            .filter((p) => p.item_id === item.id)
            .map((p) => (
              <div key={p.id}>
                {p.status === "READY" ? (
                  <FileButton id={p.id} kind="photo" label="Abrir foto" />
                ) : (
                  <p>
                    Foto{" "}
                    {p.status === "FAILED"
                      ? "com falha"
                      : "pendente de confirmação"}
                  </p>
                )}
              </div>
            ))}
          {!i.inspection_photos.some((p) => p.item_id === item.id) && (
            <p className="field-help">Nenhuma foto anexada a este item.</p>
          )}
          {editable && <PhotoUpload inspectionId={i.id} itemId={item.id} />}
        </div>
      ))}
      {editable && (
        <OperationForm
          collapsible
          title="Concluir e congelar vistoria"
          build={() => ({
            ...base,
            action: "COMPLETE_INSPECTION",
            inspection_id: i.id,
          })}
        >
          <p>
            Todos os itens devem estar respondidos. Avarias e ausências exigem
            descrição e foto; fotos obrigatórias também serão verificadas.
          </p>
        </OperationForm>
      )}
    </section>
  );
}
export function RetryContract({ r, id }: { r: RentalView; id: string }) {
  return (
    <OperationForm
      collapsible
      title="Reagendar contrato com falha"
      build={() => ({
        rental_id: r.id,
        expected_version: r.version,
        action: "RETRY_CONTRACT",
        contract_id: id,
      })}
    />
  );
}
export function AssessDamage({ r, id }: { r: RentalView; id: string }) {
  return (
    <OperationForm
      collapsible
      title="Registrar avaliação da avaria"
      build={(f) => ({
        rental_id: r.id,
        expected_version: r.version,
        action: "ASSESS_DAMAGE",
        damage_id: id,
        amount: String(f.get("amount")),
        reason: String(f.get("reason")),
      })}
    >
      <p>
        Informe o valor aprovado após avaliar a responsabilidade e a vistoria
        inicial. Zero registra a dispensa da cobrança. Esta operação não
        confirma recebimento.
      </p>
      <label className="field-label">
        Valor aprovado (R$, com ponto decimal)
        <input
          className={control}
          name="amount"
          required
          inputMode="decimal"
          pattern="[0-9]+\.[0-9]{2}"
        />
      </label>
      <label className="field-label">
        Fundamentação
        <textarea
          className={control}
          name="reason"
          minLength={5}
          maxLength={1000}
          required
        />
      </label>
    </OperationForm>
  );
}
