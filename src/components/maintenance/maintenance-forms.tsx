"use client";
import { businessInstant, businessLocalValue } from "@/lib/business/dates";
import type { MaintenanceView } from "@/lib/maintenance/service";
import { maintenanceKinds } from "@/lib/maintenance/schema";
import {
  CommandForm,
  Field,
  ReasonField,
  SelectField,
  control,
  value,
  nullable,
} from "@/components/business/command-form";
export function NewMaintenanceForm({
  vehicles,
  timezone,
}: {
  timezone: string;
  vehicles: { id: string; name: string }[];
}) {
  return (
    <CommandForm
      title="Agendar manutenção"
      showTitle={false}
      domain="maintenance"
      navigate="maintenance"
      build={(f) => ({
        action: "CREATE",
        vehicle_id: value(f, "vehicle_id"),
        kind: value(f, "kind"),
        mileage: Number(value(f, "mileage")),
        start_at: businessInstant(value(f, "start_at"), timezone),
        end_at: businessInstant(value(f, "end_at"), timezone),
        blocks_availability: f.get("blocks") === "on",
        description: value(f, "description"),
      })}
    >
      <SelectField name="vehicle_id" label="Veículo" options={vehicles} />
      <label className="field-label">
        Serviço
        <select className={control} name="kind">
          {Object.entries(maintenanceKinds).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <Field name="mileage" label="Quilometragem informada" type="number" />
      <Field
        name="start_at"
        label={`Início (${timezone})`}
        type="datetime-local"
      />
      <Field
        name="end_at"
        label={`Fim previsto (${timezone})`}
        type="datetime-local"
      />
      <ReasonField name="description" label="Descrição do serviço" />
      <label className="field-label">
        <input type="checkbox" name="blocks" defaultChecked /> Bloquear
        disponibilidade do veículo neste período
      </label>
      <p>
        Conflitos com reservas, locações ou outros bloqueios impedem o
        agendamento. Trate os compromissos antes de tentar novamente.
      </p>
    </CommandForm>
  );
}
export function MaintenanceWorkflow({
  m,
  methods,
  canExpense,
  timezone,
}: {
  timezone: string;
  m: MaintenanceView;
  methods: { id: string; name: string }[];
  canExpense: boolean;
}) {
  const base = { maintenance_id: m.id, expected_version: m.version };
  if (["COMPLETED", "CANCELLED"].includes(m.status)) return null;
  return (
    <div className="maintenance-commands">
      {m.status === "SCHEDULED" && (
        <>
          <CommandForm
            collapsible
            title="Iniciar manutenção"
            domain="maintenance"
            build={() => ({ ...base, action: "START" })}
          >
            <p>
              A execução deve começar na janela agendada, com o veículo
              disponível.
            </p>
          </CommandForm>
          <CommandForm
            collapsible
            title="Reagendar manutenção"
            domain="maintenance"
            build={(f) => ({
              ...base,
              action: "RESCHEDULE",
              start_at: businessInstant(value(f, "start_at"), timezone),
              end_at: businessInstant(value(f, "end_at"), timezone),
            })}
          >
            <Field
              name="start_at"
              label={`Novo início (${timezone})`}
              type="datetime-local"
              value={businessLocalValue(m.start_at, timezone)}
            />
            <Field
              name="end_at"
              label={`Novo fim (${timezone})`}
              type="datetime-local"
              value={businessLocalValue(m.end_at, timezone)}
            />
          </CommandForm>
        </>
      )}
      {m.status === "IN_PROGRESS" && (
        <>
          <CommandForm
            collapsible
            title="Estender prazo da manutenção"
            domain="maintenance"
            build={(f) => ({
              ...base,
              action: "EXTEND",
              end_at: businessInstant(value(f, "end_at"), timezone),
            })}
          >
            <Field
              name="end_at"
              label={`Novo fim (${timezone})`}
              type="datetime-local"
            />
            <p>
              A extensão revalida todos os compromissos e é desfeita se houver
              conflito.
            </p>
          </CommandForm>
          <CommandForm
            collapsible
            title="Concluir manutenção"
            domain="maintenance"
            build={(f) => ({
              ...base,
              action: "COMPLETE",
              mileage: Number(value(f, "mileage")),
              next_due_on: nullable(f, "next_due_on"),
              next_due_mileage:
                value(f, "next_due_mileage") === ""
                  ? null
                  : Number(value(f, "next_due_mileage")),
              expense:
                canExpense && f.get("expense") === "on"
                  ? {
                      amount: value(f, "amount"),
                      payment_method_id: value(f, "payment_method_id"),
                      occurred_at: businessInstant(
                        value(f, "occurred_at"),
                        timezone,
                      ),
                      description: value(f, "description"),
                      paid: f.get("paid") === "on",
                    }
                  : null,
            })}
          >
            <Field
              name="mileage"
              label="Quilometragem final"
              type="number"
              value={m.mileage}
            />
            <Field
              name="next_due_on"
              label="Próxima manutenção por data (opcional)"
              type="date"
              required={false}
            />
            <Field
              name="next_due_mileage"
              label="Próxima manutenção por km (opcional)"
              type="number"
              required={false}
            />
            {canExpense && (
              <details className="business-disclosure">
                <summary className="cursor-pointer">
                  Registrar despesa junto com a conclusão
                </summary>
                <div className="mt-4 space-y-4">
                  <label className="field-label">
                    <input type="checkbox" name="expense" /> Incluir despesa
                    nesta operação
                  </label>
                  <label className="field-label">
                    Valor pago (R$)
                    <input
                      className={control}
                      name="amount"
                      inputMode="decimal"
                      placeholder="100.00"
                    />
                  </label>
                  <label className="field-label">
                    Meio utilizado
                    <select name="payment_method_id" className={control}>
                      <option value="">Escolha</option>
                      {methods.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    name="occurred_at"
                    label={`Data do pagamento (${timezone})`}
                    type="datetime-local"
                    required={false}
                  />
                  <label className="field-label">
                    Descrição
                    <textarea
                      className={control}
                      name="description"
                      minLength={5}
                      maxLength={1000}
                    />
                  </label>
                  <label className="field-label">
                    <input type="checkbox" name="paid" /> Confirmo o pagamento
                    efetivo da despesa
                  </label>
                </div>
              </details>
            )}
            <p>
              A despesa opcional e a conclusão são salvas na mesma transação. Se
              algum dado falhar, a manutenção continua aberta.
            </p>
          </CommandForm>
        </>
      )}
      <CommandForm
        collapsible
        title="Cancelar manutenção"
        domain="maintenance"
        build={(f) => ({
          ...base,
          action: "CANCEL",
          reason: value(f, "reason"),
        })}
      >
        <ReasonField />
      </CommandForm>
    </div>
  );
}
