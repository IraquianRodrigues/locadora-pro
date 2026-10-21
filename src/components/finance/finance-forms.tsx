"use client";
import { useState } from "react";
import type { FinanceOptions, RegisterRow } from "@/lib/finance/service";
import { currency } from "@/lib/finance/money";
import {
  CommandForm,
  Field,
  MoneyField,
  ReasonField,
  SelectField,
  control,
  value,
  nullable,
} from "@/components/business/command-form";
import { businessInstant } from "@/lib/business/dates";
type Props = {
  timezone: string;
  options: FinanceOptions;
  permissions: string[];
  customer?: string | null;
  rental?: string | null;
};
const rowString = (row: RegisterRow, k: string) => String(row[k] ?? "");
export function FinanceCreateForms({
  options: o,
  permissions: p,
  customer,
  rental,
  timezone,
}: Props) {
  const can = (v: string) => p.includes(v),
    rentals = o.rentals.map((r) => ({
      id: r.id,
      name: `${r.id.slice(0, 8)} · ${r.status}`,
    }));
  return (
    <div className="business-create-forms">
      {can("charges.create") && (
        <CommandForm
          collapsible
          title="Criar cobrança"
          domain="finance"
          build={(f) => ({
            action: "CHARGE",
            customer_id: value(f, "customer_id"),
            rental_id: nullable(f, "rental_id"),
            kind: value(f, "kind"),
            amount: value(f, "amount"),
            due_at: businessInstant(value(f, "due_at"), timezone),
            competence_at: businessInstant(value(f, "competence_at"), timezone),
            description: value(f, "description"),
          })}
        >
          <SelectField
            name="customer_id"
            label="Cliente"
            options={o.customers}
            value={customer ?? undefined}
          />
          <SelectField
            name="rental_id"
            label="Locação (opcional)"
            options={rentals}
            optional
            value={rental ?? undefined}
          />
          <label className="field-label">
            Tipo
            <select className={control} name="kind">
              <option value="MANUAL">Cobrança manual</option>
              <option value="FINE">Multa fundamentada</option>
            </select>
          </label>
          <MoneyField />
          <Field
            name="competence_at"
            label={`Competência (${timezone})`}
            type="datetime-local"
          />
          <Field
            name="due_at"
            label={`Vencimento (${timezone})`}
            type="datetime-local"
          />
          <ReasonField
            name="description"
            label="Descrição e fundamento da cobrança"
          />
        </CommandForm>
      )}
      {can("payments.confirm") && (
        <PaymentForm options={o} customer={customer ?? undefined} />
      )}
      {can("deposits.manage") && (
        <CommandForm
          collapsible
          title="Confirmar recebimento de caução"
          domain="finance"
          build={(f) => ({
            action: "DEPOSIT_RECEIVE",
            rental_id: value(f, "rental_id"),
            payment_method_id: value(f, "payment_method_id"),
            amount: value(f, "amount"),
            received: f.get("received") === "on",
          })}
        >
          <SelectField
            name="rental_id"
            label="Locação"
            options={rentals.filter(
              (r) =>
                o.rentals.find((x) => x.id === r.id)?.status !== "CANCELLED",
            )}
            value={rental ?? undefined}
          />
          <SelectField
            name="payment_method_id"
            label="Meio utilizado"
            options={o.methods}
          />
          <MoneyField />
          <label className="field-label">
            <input type="checkbox" name="received" required /> Confirmo que a
            caução foi efetivamente recebida.
          </label>
          <p>
            Caução fica separada da receita e pode ser aplicada ou devolvida com
            registro próprio.
          </p>
        </CommandForm>
      )}
      {can("expenses.write") && <ExpenseForm options={o} timezone={timezone} />}
    </div>
  );
}
function PaymentForm({
  options: o,
  customer,
}: {
  options: FinanceOptions;
  customer?: string;
}) {
  const [allocations, setAllocations] = useState(1);
  return (
    <CommandForm
      collapsible
      title="Confirmar recebimento"
      domain="finance"
      build={(f) => ({
        action: "PAYMENT",
        customer_id: value(f, "customer_id"),
        payment_method_id: value(f, "payment_method_id"),
        amount: value(f, "amount"),
        received: f.get("received") === "on",
        allocations: Array.from({ length: allocations }, (_, i) => ({
          charge_id: value(f, `charge_${i}`),
          amount: value(f, `amount_${i}`),
        })).filter((a) => a.charge_id),
      })}
    >
      <SelectField
        name="customer_id"
        label="Cliente"
        options={o.customers}
        value={customer}
      />
      <SelectField
        name="payment_method_id"
        label="Meio utilizado"
        options={o.methods}
      />
      <MoneyField />
      <label className="field-label">
        Número de cobranças a liquidar (zero mantém crédito)
        <input
          className={control}
          type="number"
          value={allocations}
          min={0}
          max={20}
          onChange={(e) =>
            setAllocations(Math.min(20, Math.max(0, Number(e.target.value))))
          }
        />
      </label>
      {Array.from({ length: allocations }, (_, i) => (
        <fieldset key={i} className="business-allocation">
          <legend>Cobrança {i + 1}</legend>
          <Field name={`charge_${i}`} label="Identificador da cobrança" />
          <MoneyField
            name={`amount_${i}`}
            label="Valor a alocar nesta cobrança (R$)"
          />
        </fieldset>
      ))}
      <label className="field-label">
        <input name="received" type="checkbox" required /> Confirmo que o valor
        foi efetivamente recebido.
      </label>
      <p>
        Não registre PAN, CVV ou outros dados sensíveis de cartão. O saldo
        restante vira crédito do cliente.
      </p>
    </CommandForm>
  );
}
function ExpenseForm({
  options: o,
  timezone,
}: {
  options: FinanceOptions;
  timezone: string;
}) {
  return (
    <CommandForm
      collapsible
      title="Registrar despesa paga"
      domain="finance"
      build={(f) => ({
        action: "EXPENSE",
        vehicle_id: nullable(f, "vehicle_id"),
        maintenance_id: nullable(f, "maintenance_id"),
        payment_method_id: value(f, "payment_method_id"),
        amount: value(f, "amount"),
        occurred_at: businessInstant(value(f, "occurred_at"), timezone),
        description: value(f, "description"),
        paid: f.get("paid") === "on",
      })}
    >
      <SelectField
        name="vehicle_id"
        label="Veículo (opcional)"
        options={o.vehicles}
        optional
      />
      <Field
        name="maintenance_id"
        label="Identificador de manutenção (opcional)"
        required={false}
      />
      <SelectField
        name="payment_method_id"
        label="Meio utilizado"
        options={o.methods}
      />
      <MoneyField />
      <Field
        name="occurred_at"
        label={`Data do pagamento (${timezone})`}
        type="datetime-local"
      />
      <ReasonField name="description" label="Descrição da despesa" />
      <label className="field-label">
        <input type="checkbox" name="paid" required /> Confirmo o pagamento da
        despesa.
      </label>
    </CommandForm>
  );
}
export function FinancialRowActions({
  row: r,
  kind,
  options: o,
  permissions: p,
}: {
  row: RegisterRow;
  kind: string;
  options: FinanceOptions;
  permissions: string[];
}) {
  const id = rowString(r, "id"),
    can = (v: string) => p.includes(v),
    balance = Number(r.balance ?? 0),
    free = Number(r.free_amount ?? 0);
  return (
    <div className="space-y-4">
      {kind === "CHARGES" && balance > 0 && can("payments.confirm") && (
        <CommandForm
          collapsible
          title="Receber nesta cobrança"
          domain="finance"
          build={(f) => ({
            action: "PAYMENT",
            customer_id: r.customer_id,
            payment_method_id: value(f, "payment_method_id"),
            amount: value(f, "amount"),
            received: f.get("received") === "on",
            allocations: [{ charge_id: id, amount: value(f, "amount") }],
          })}
        >
          <p>Saldo: {currency(r.balance)}.</p>
          <SelectField
            name="payment_method_id"
            label="Meio utilizado"
            options={o.methods}
          />
          <MoneyField />
          <label className="field-label">
            <input type="checkbox" name="received" required /> Recebimento
            efetivamente confirmado.
          </label>
        </CommandForm>
      )}
      {kind === "CHARGES" &&
        balance > 0 &&
        can("charges.create") &&
        (can("discounts.authorize") || can("refunds.create")) && (
          <CommandForm
            collapsible
            title="Creditar ou ajustar cobrança"
            domain="finance"
            build={(f) => ({
              action: "ADJUST",
              charge_id: id,
              kind: value(f, "kind"),
              amount: value(f, "amount"),
              reason: value(f, "reason"),
            })}
          >
            <p>
              O crédito reduz a obrigação, sem apagar o lançamento nem devolver
              dinheiro.
            </p>
            <label className="field-label">
              Tipo
              <select name="kind" className={control}>
                {can("discounts.authorize") && (
                  <option value="DISCOUNT">
                    Desconto dentro do limite configurado
                  </option>
                )}
                {can("refunds.create") && (
                  <>
                    <option value="CANCEL">Cancelamento da obrigação</option>
                    <option value="CORRECTION">Correção fundamentada</option>
                  </>
                )}
              </select>
            </label>
            <MoneyField />
            <ReasonField />
          </CommandForm>
        )}
      {kind === "PAYMENTS" && free > 0 && can("payments.confirm") && (
        <CommandForm
          collapsible
          title="Alocar crédito recebido"
          domain="finance"
          build={(f) => ({
            action: "ALLOCATE",
            payment_id: id,
            charge_id: value(f, "charge_id"),
            amount: value(f, "amount"),
          })}
        >
          <p>Crédito livre: {currency(r.free_amount)}.</p>
          <Field
            name="charge_id"
            label="Identificador da cobrança do mesmo cliente"
          />
          <MoneyField />
        </CommandForm>
      )}
      {kind === "PAYMENTS" && can("refunds.create") && (
        <>
          <RefundForm
            source={{ payment_id: id, deposit_id: null, allocation_id: null }}
            options={o}
            label="Reembolsar crédito não alocado"
          />
          {Array.isArray(r.allocations) &&
            r.allocations.map((raw, i) => {
              const a = raw as Record<string, unknown>;
              return (
                <div key={String(a.id ?? i)}>
                  <p>
                    Alocação {String(a.id)} · cobrança {String(a.charge_id)} ·{" "}
                    {currency(a.amount)} · reembolsável {currency(a.refundable)}
                  </p>
                  {Number(a.refundable) > 0 && (
                    <RefundForm
                      source={{
                        payment_id: id,
                        deposit_id: null,
                        allocation_id: String(a.id),
                      }}
                      options={o}
                      label="Reembolsar valor alocado"
                    />
                  )}
                </div>
              );
            })}
        </>
      )}
      {kind === "DEPOSITS" && balance > 0 && can("deposits.manage") && (
        <CommandForm
          collapsible
          title="Aplicar caução em cobrança"
          domain="finance"
          build={(f) => ({
            action: "DEPOSIT_APPLY",
            deposit_id: id,
            charge_id: value(f, "charge_id"),
            amount: value(f, "amount"),
            reason: value(f, "reason"),
          })}
        >
          <p>
            A aplicação liquida uma obrigação da mesma locação; não representa
            uma nova entrada de caixa.
          </p>
          <Field name="charge_id" label="Identificador da cobrança" />
          <MoneyField />
          <ReasonField />
        </CommandForm>
      )}
      {kind === "DEPOSITS" && balance > 0 && can("refunds.create") && (
        <RefundForm
          source={{ payment_id: null, deposit_id: id, allocation_id: null }}
          options={o}
          label="Devolver caução disponível"
        />
      )}
      {kind === "DEPOSITS" &&
        Array.isArray(r.applications) &&
        r.applications.map((raw, i) => {
          const a = raw as Record<string, unknown>;
          return (
            <div key={String(a.id ?? i)}>
              <p>
                Aplicação {String(a.id)} · cobrança {String(a.charge_id)} ·
                reversível {currency(a.reversible)}
              </p>
              {Number(a.reversible) > 0 && can("deposits.manage") && (
                <CommandForm
                  collapsible
                  title="Estornar aplicação de caução"
                  domain="finance"
                  build={(f) => ({
                    action: "DEPOSIT_UNAPPLY",
                    application_id: String(a.id),
                    amount: value(f, "amount"),
                    reason: value(f, "reason"),
                  })}
                >
                  <p>
                    Reabre a cobrança e devolve o saldo à caução; não realiza
                    devolução de dinheiro.
                  </p>
                  <MoneyField />
                  <ReasonField />
                </CommandForm>
              )}
            </div>
          );
        })}
      {kind === "EXPENSES" &&
        Number(r.reversible) > 0 &&
        can("expenses.write") && (
          <CommandForm
            collapsible
            title="Registrar estorno de despesa"
            domain="finance"
            build={(f) => ({
              action: "EXPENSE_REVERSE",
              expense_id: id,
              amount: value(f, "amount"),
              reason: value(f, "reason"),
              confirmed: f.get("confirmed") === "on",
            })}
          >
            <p>O lançamento compensatório fica separado da despesa original.</p>
            <MoneyField />
            <ReasonField />
            <label className="field-label">
              <input type="checkbox" name="confirmed" required /> Confirmo o
              estorno registrado.
            </label>
          </CommandForm>
        )}
    </div>
  );
}
function RefundForm({
  source,
  options: o,
  label,
}: {
  source: {
    payment_id: string | null;
    deposit_id: string | null;
    allocation_id: string | null;
  };
  options: FinanceOptions;
  label: string;
}) {
  return (
    <CommandForm
      collapsible
      title={label}
      domain="finance"
      build={(f) => ({
        action: "REFUND",
        ...source,
        amount: value(f, "amount"),
        payment_method_id: value(f, "payment_method_id"),
        reason: value(f, "reason"),
        paid_out: f.get("paid_out") === "on",
      })}
    >
      <SelectField
        name="payment_method_id"
        label="Meio da devolução efetiva"
        options={o.methods}
      />
      <MoneyField />
      <ReasonField />
      <label className="field-label">
        <input type="checkbox" name="paid_out" required /> Confirmo que o
        dinheiro foi efetivamente devolvido.
      </label>
      <p>
        Esta confirmação registra uma devolução manual; não aciona Pix, cartão
        ou banco.
      </p>
    </CommandForm>
  );
}
