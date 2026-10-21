"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { rentalAction } from "@/lib/rentals/actions";
import { Button } from "@/components/ui/button";
import {
  quoteAction,
  requestReservationAction,
} from "@/lib/reservations/actions";
import { searchRegistryOptionsAction } from "@/lib/registry/actions";
import type { Resource } from "@/lib/registry/schema";
import type { QuoteView } from "@/lib/reservations/service";
import { QuoteSummary } from "./quote-summary";
import { localBookingInstant } from "@/lib/public/dates";
type Option = { id: string; name: string };
const control = "workspace-control";
function Lookup({
  resource,
  name,
  label,
  initial,
  optional = false,
  disabled,
}: {
  resource: Resource;
  name: string;
  label: string;
  initial: Option[];
  optional?: boolean;
  disabled: boolean;
}) {
  const [options, setOptions] = useState(initial),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(""),
    [error, setError] = useState("");
  return (
    <div className="form-field">
      <label className="field-label" htmlFor={name}>
        {label}
        {optional ? " (opcional)" : ""}
      </label>
      <div className="field-lookup">
        <input
          className={control}
          aria-label={`Buscar ${label}`}
          type="search"
          value={search}
          maxLength={100}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled || busy}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await searchRegistryOptionsAction(resource, search);
              if (r.ok) {
                setOptions(r.data);
                setError("");
              } else setError(r.message);
            } catch {
              setError("Busca indisponível.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Buscar
        </Button>
      </div>
      <select
        id={name}
        name={name}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        required={!optional}
        disabled={disabled}
        className={control}
      >
        <option value="">Selecione</option>
        {selected && !options.some((o) => o.id === selected) && (
          <option value={selected}>Selecionado · {selected}</option>
        )}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
function Address({ prefix }: { prefix: string }) {
  return (
    <fieldset className="address-fields">
      <legend>Endereço de {prefix === "pickup" ? "entrega" : "coleta"}</legend>
      <div className="form-grid">
        {[
          ["postal_code", "CEP"],
          ["street", "Logradouro"],
          ["number", "Número"],
          ["district", "Bairro"],
          ["city", "Cidade"],
          ["state", "UF"],
          ["complement", "Complemento"],
        ].map(([key, label]) => (
          <label key={key} className="field-label">
            {label}
            <input
              name={`${prefix}_${key}`}
              required={key !== "complement"}
              maxLength={160}
              className={control}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function BookingForm({
  options,
  canDiscount,
  mode = "reservation",
}: {
  options: Record<string, Option[]>;
  canDiscount: boolean;
  mode?: "reservation" | "rental";
}) {
  const router = useRouter();
  const [quote, setQuote] = useState<QuoteView | null>(null),
    [stock, setStock] = useState<number | null>(null),
    [pickup, setPickup] = useState("BRANCH"),
    [back, setBack] = useState("BRANCH"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<{ id: string; lookup_token: string } | null>(
      null,
    ),
    [services, setServices] = useState<string[]>([]);
  const quoteAttempt = useRef<{
      payload: string;
      key: string;
      expires?: string;
    } | null>(null),
    requestKey = useRef<{ payload: string; key: string } | null>(null),
    form = useRef<HTMLFormElement>(null);
  function invalidate() {
    setQuote(null);
    setStock(null);
    setMessage("");
  }
  async function calculate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const data = new FormData(e.currentTarget),
      value = (k: string) => String(data.get(k) ?? "");
    const address = (prefix: string) =>
      Object.fromEntries(
        [
          "postal_code",
          "street",
          "number",
          "district",
          "city",
          "state",
          "complement",
        ].map((k) => [k, value(`${prefix}_${k}`)]),
      );
    let startAt: string, endAt: string;
    try {
      startAt = localBookingInstant(value("start_at"), "America/Fortaleza");
      endAt = localBookingInstant(value("end_at"), "America/Fortaleza");
    } catch {
      setMessage("Confira a data e a hora da retirada e da devolução.");
      setBusy(false);
      return;
    }
    const input = {
      rate_plan_id: value("rate_plan_id"),
      branch_id: value("branch_id"),
      category_id: value("category_id") || null,
      vehicle_id: value("vehicle_id") || null,
      customer_id: value("customer_id") || null,
      start_at: startAt,
      end_at: endAt,
      additional_services: services.map((id) => ({
        id,
        quantity: Number(value(`qty_${id}`)),
      })),
      pickup_mode: pickup,
      return_mode: back,
      pickup_address: pickup === "DELIVERY" ? address("pickup") : null,
      return_address: back === "COLLECTION" ? address("return") : null,
      instructions: value("instructions"),
      discount_amount: canDiscount ? value("discount_amount") : "0.00",
      discount_reason: canDiscount ? value("discount_reason") : "",
    };
    const payload = JSON.stringify(input);
    if (
      quoteAttempt.current?.payload !== payload ||
      (quoteAttempt.current?.expires &&
        Date.parse(quoteAttempt.current.expires) <= Date.now())
    )
      quoteAttempt.current = { payload, key: crypto.randomUUID() };
    try {
      const r = await quoteAction(input, quoteAttempt.current!.key);
      if (r.ok) {
        quoteAttempt.current!.expires = r.quote.expires_at;
        setQuote(r.quote);
        setStock(r.stock.available);
      } else setMessage(r.message);
    } catch {
      setMessage(
        "Não foi possível cotar. Tente novamente com os mesmos dados.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function request() {
    if (!quote || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const data = new FormData(form.current!),
        customer = String(data.get("customer_id") ?? "");
      if (!customer) {
        setMessage("Escolha o cliente antes de solicitar.");
        return;
      }
      const vehicle = String(data.get("vehicle_id") ?? "");
      if (mode === "rental" && !vehicle) {
        setMessage("Selecione um veículo específico e calcule novamente.");
        return;
      }
      const payload = JSON.stringify([quote.id, customer, vehicle, mode]);
      if (requestKey.current?.payload !== payload)
        requestKey.current = { payload, key: crypto.randomUUID() };
      if (mode === "rental") {
        const created = await rentalAction(
          "create",
          { quote_id: quote.id, vehicle_id: vehicle },
          requestKey.current.key,
        );
        if (created.ok && created.id)
          router.push(`/admin/locacoes/${created.id}`);
        else if (!created.ok) setMessage(created.message);
        return;
      }
      const r = await requestReservationAction({
        quote_id: quote.id,
        customer_id: customer,
        idempotency_key: requestKey.current.key,
      });
      if (r.ok) setResult(r);
      else setMessage(r.message);
    } catch {
      setMessage(
        "Não foi possível solicitar. Tente novamente sem alterar os dados.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (result)
    return (
      <section
        className="booking-result workspace-notice"
        aria-label="Solicitação registrada"
      >
        <h2 className="text-xl font-bold">Solicitação registrada</h2>
        <p>
          Status: solicitada, aguardando análise. A disponibilidade será
          validada na aprovação.
        </p>
        <p>Token de consulta (guarde em local seguro):</p>
        <code className="block break-all rounded bg-muted p-3">
          {result.lookup_token}
        </code>
        <Link href={`/admin/reservas/${result.id}`} className="underline">
          Abrir reserva
        </Link>
      </section>
    );
  return (
    <div className="booking-workspace">
      <form
        ref={form}
        onSubmit={calculate}
        onChange={invalidate}
        className="workspace-form"
      >
        <fieldset disabled={busy} className="booking-controls">
          <fieldset className="form-section">
            <legend>Veículo, cliente e período</legend>
            <p className="form-section-description">
              {mode === "rental"
                ? "Selecione o veículo e o cliente desta locação direta."
                : "Selecione somente uma categoria ou um veículo específico."}
            </p>
            <div className="form-grid">
              <Lookup
                name="rate_plan_id"
                resource="planos"
                label="Plano tarifário"
                initial={options.planos ?? []}
                disabled={busy}
              />
              <Lookup
                name="branch_id"
                resource="unidades"
                label="Unidade"
                initial={options.unidades ?? []}
                disabled={busy}
              />
              {mode !== "rental" && (
                <Lookup
                  name="category_id"
                  resource="categorias"
                  label="Categoria (ou veículo)"
                  optional
                  initial={options.categorias ?? []}
                  disabled={busy}
                />
              )}
              <Lookup
                name="vehicle_id"
                resource="frota"
                label={mode === "rental" ? "Veículo" : "Veículo (ou categoria)"}
                optional={mode !== "rental"}
                initial={options.frota ?? []}
                disabled={busy}
              />
              <Lookup
                name="customer_id"
                resource="clientes"
                label="Cliente"
                optional={mode !== "rental"}
                initial={options.clientes ?? []}
                disabled={busy}
              />
              {[
                ["start_at", "Data e hora da retirada"],
                ["end_at", "Data e hora da devolução"],
              ].map(([key, label]) => (
                <label key={key} className="field-label">
                  {label}
                  <input
                    name={key}
                    required
                    type="datetime-local"
                    step={60}
                    className={control}
                  />
                  <span className="field-help">Horário de Fortaleza.</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="form-section">
            <legend>Retirada e devolução</legend>
            <div className="form-grid">
              <label className="field-label">
                Retirada
                <select
                  className={control}
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                >
                  <option value="BRANCH">Na unidade</option>
                  <option value="DELIVERY">Entrega</option>
                </select>
              </label>
              <label className="field-label">
                Devolução
                <select
                  className={control}
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                >
                  <option value="BRANCH">Na unidade</option>
                  <option value="COLLECTION">Coleta</option>
                </select>
              </label>
            </div>
            {pickup === "DELIVERY" && <Address prefix="pickup" />}
            {back === "COLLECTION" && <Address prefix="return" />}
          </fieldset>
          <fieldset className="form-section">
            <legend>Adicionais</legend>
            <p className="form-section-description">
              Cadastre os serviços em Serviços adicionais. Até 20 tipos por
              cotação.
            </p>
            {(options.adicionais ?? []).map((s) => (
              <div key={s.id} className="addon-row">
                <label>
                  <input
                    type="checkbox"
                    checked={services.includes(s.id)}
                    onChange={(e) =>
                      setServices((old) =>
                        e.target.checked
                          ? [...old, s.id]
                          : old.filter((id) => id !== s.id),
                      )
                    }
                  />{" "}
                  {s.name}
                </label>
                {services.includes(s.id) && (
                  <label>
                    Quantidade
                    <input
                      type="number"
                      name={`qty_${s.id}`}
                      min={1}
                      max={100}
                      defaultValue={1}
                      required
                      className={control}
                    />
                  </label>
                )}
              </div>
            ))}
          </fieldset>
          {canDiscount && (
            <fieldset className="form-section">
              <legend>Desconto autorizado</legend>
              <div className="form-grid">
                <label className="field-label">
                  Desconto (R$)
                  <input
                    name="discount_amount"
                    defaultValue="0.00"
                    required
                    className={control}
                  />
                </label>
                <label className="field-label">
                  Motivo do desconto
                  <input
                    name="discount_reason"
                    maxLength={500}
                    className={control}
                  />
                </label>
              </div>
            </fieldset>
          )}
          <label className="field-label booking-instructions">
            Instruções de logística
            <textarea name="instructions" maxLength={500} className={control} />
          </label>
          <div className="form-actions">
            <Button type="submit">
              {busy ? "Calculando…" : "Calcular cotação"}
            </Button>
          </div>
        </fieldset>
      </form>
      {message && (
        <p role="alert" className="workspace-notice workspace-notice-attention">
          {message}
        </p>
      )}
      {quote && (
        <>
          <QuoteSummary quote={quote} />
          <p role="status">
            Disponibilidade indicativa: {stock} veículo(s). Confirmada somente
            na aprovação.
          </p>
          <Button
            type="button"
            disabled={busy || stock === 0}
            onClick={request}
          >
            {busy
              ? "Registrando…"
              : mode === "rental"
                ? "Criar locação direta"
                : "Solicitar reserva para análise"}
          </Button>
        </>
      )}
    </div>
  );
}
