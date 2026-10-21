"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Challenge } from "./challenge";
import { formatBRL } from "@/lib/pricing/money";
import { localBookingInstant } from "@/lib/public/dates";
import type { PublicQuote, PublicSite } from "@/lib/public/schema";
type Option = {
  id: string;
  name: string;
  timezone?: string;
  unit?: string;
  amount?: string;
};
type Session = {
  site: PublicSite;
  site_key: string;
  options: {
    branches: Option[];
    categories: Option[];
    plans: Option[];
    services: Option[];
  };
};
const field =
  "mt-2 min-h-11 w-full rounded-lg border border-border bg-white px-3 py-2 focus-visible:ring-2 focus-visible:ring-ring";
async function post<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/public/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data ?? {}),
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.error?.message ?? "Atendimento indisponível. Tente novamente.",
    );
  return body.data;
}
function AddressFields({ prefix, title }: { prefix: string; title: string }) {
  return (
    <fieldset className="rounded-xl border border-border p-4">
      <legend className="font-semibold">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["postal_code", "CEP"],
          ["street", "Logradouro"],
          ["number", "Número"],
          ["district", "Bairro"],
          ["city", "Cidade"],
          ["state", "UF"],
          ["complement", "Complemento (opcional)"],
        ].map(([key, label]) => (
          <label key={key} className="text-sm">
            {label}
            <input
              name={`${prefix}_${key}`}
              className={field}
              required={key !== "complement"}
              maxLength={160}
              autoComplete={
                prefix === "customer"
                  ? (
                      {
                        postal_code: "postal-code",
                        street: "address-line1",
                        city: "address-level2",
                        state: "address-level1",
                      } as Record<string, string>
                    )[key]
                  : "off"
              }
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function Honeypot() {
  return (
    <div className="absolute -left-[10000px]" aria-hidden="true">
      <label>
        Deixe em branco
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}
export function PublicBooking({ vehicleId }: { vehicleId?: string }) {
  const [session, setSession] = useState<Session | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [captcha, setCaptcha] = useState(""),
    [requestCaptcha, setRequestCaptcha] = useState(""),
    [reset, setReset] = useState(0),
    [quote, setQuote] = useState<PublicQuote | null>(null),
    [pickup, setPickup] = useState("BRANCH"),
    [back, setBack] = useState("BRANCH"),
    [services, setServices] = useState<string[]>([]),
    [vehicle, setVehicle] = useState<{
      id: string;
      branch_id: string;
      make: string;
      model: string;
    } | null>(null),
    [result, setResult] = useState<{ id: string; lookup_token: string } | null>(
      null,
    );
  const quoteAttempt = useRef<{
      payload: string;
      key: string;
      expires?: string;
    } | null>(null),
    requestAttempt = useRef<{ payload: string; key: string } | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const s = await post<Session>("session");
        if (active) setSession(s);
        if (vehicleId) {
          const r = await fetch(
            `/api/v1/public/vehicles/${encodeURIComponent(vehicleId)}`,
          );
          const body = await r.json();
          if (!r.ok)
            throw new Error("Veículo não disponível. Escolha pelo catálogo.");
          if (active) setVehicle(body.data);
        }
      } catch (e) {
        if (active)
          setMessage(
            e instanceof Error
              ? e.message
              : "Atendimento online em preparação.",
          );
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [vehicleId]);
  const value = (data: FormData, key: string) => String(data.get(key) ?? "");
  const address = (data: FormData, prefix: string) =>
    Object.fromEntries(
      [
        "postal_code",
        "street",
        "number",
        "district",
        "city",
        "state",
        "complement",
      ].map((k) => [k, value(data, `${prefix}_${k}`)]),
    );
  async function calculate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !session) return;
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const plan = session.options.plans.find(
        (p) => p.id === value(data, "rate_plan_id"),
      );
      if (!plan?.timezone) throw new Error("Escolha um plano disponível.");
      const input = {
        rate_plan_id: plan.id,
        branch_id: vehicle?.branch_id ?? value(data, "branch_id"),
        category_id: vehicle ? null : value(data, "category_id"),
        vehicle_id: vehicle?.id ?? null,
        start_at: localBookingInstant(value(data, "start_at"), plan.timezone),
        end_at: localBookingInstant(value(data, "end_at"), plan.timezone),
        additional_services: services.map((id) => ({
          id,
          quantity: Number(value(data, `qty_${id}`)),
        })),
        pickup_mode: pickup,
        return_mode: back,
        pickup_address: pickup === "DELIVERY" ? address(data, "pickup") : null,
        return_address: back === "COLLECTION" ? address(data, "return") : null,
        instructions: value(data, "instructions"),
      };
      const payload = JSON.stringify(input);
      if (
        quoteAttempt.current?.payload !== payload ||
        (quoteAttempt.current.expires &&
          Date.parse(quoteAttempt.current.expires) <= Date.now())
      )
        quoteAttempt.current = { payload, key: crypto.randomUUID() };
      const q = await post<PublicQuote>("quotes", {
        input,
        idempotency_key: quoteAttempt.current!.key,
        captcha,
        website: value(data, "website"),
      });
      quoteAttempt.current!.expires = q.expires_at;
      setQuote(q);
      setCaptcha("");
      setReset((old) => old + 1);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Não foi possível calcular. Confira os dados e o horário informado.",
      );
      setCaptcha("");
      setReset((old) => old + 1);
    } finally {
      setBusy(false);
    }
  }
  async function request(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !session || !quote) return;
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const customer = {
        person_type: value(data, "person_type"),
        name: value(data, "name"),
        tax_document: value(data, "tax_document"),
        email: value(data, "email"),
        phone: value(data, "phone"),
        birth_date: value(data, "birth_date") || null,
        ...address(data, "customer"),
      };
      const payload = {
        quote_id: quote.id,
        customer,
        terms_version: session.site.terms_version,
        accepted: data.get("accepted") === "on",
      };
      const text = JSON.stringify(payload);
      if (requestAttempt.current?.payload !== text)
        requestAttempt.current = { payload: text, key: crypto.randomUUID() };
      setResult(
        await post("reservations", {
          ...payload,
          idempotency_key: requestAttempt.current!.key,
          captcha: requestCaptcha,
          website: value(data, "website"),
        }),
      );
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Não foi possível enviar. Tente novamente com os mesmos dados.",
      );
      setRequestCaptcha("");
      setReset((old) => old + 1);
    } finally {
      setBusy(false);
    }
  }
  if (result)
    return (
      <section
        className="rounded-2xl border border-border bg-white p-6"
        aria-live="polite"
      >
        <h2 className="text-2xl font-bold">Solicitação recebida</h2>
        <p className="mt-4">
          Sua reserva aguarda análise. A equipe confirmará a disponibilidade e
          as condições antes da retirada. Não foi realizado pagamento.
        </p>
        <p className="mt-5">
          Referência: <strong className="break-all">{result.id}</strong>
        </p>
        <p className="mt-4">
          Guarde este token em local seguro para consultar a situação:
        </p>
        <code className="my-3 block break-all rounded-lg bg-muted p-3">
          {result.lookup_token}
        </code>
        <p>
          Referência e token são necessários. Não publique nem compartilhe o
          token.
        </p>
        <Link className="mt-5 inline-block underline" href="/consultar-reserva">
          Consultar solicitação
        </Link>
      </section>
    );
  if (!session)
    return (
      <div className="rounded-xl border border-border p-6">
        <p role={message ? "alert" : "status"}>
          {message || "Carregando atendimento…"}
        </p>
        <Link className="mt-4 inline-block underline" href="/contato">
          Ver atendimento da locadora
        </Link>
      </div>
    );
  if (
    !session.options.plans.length ||
    !session.options.branches.length ||
    !session.options.categories.length
  )
    return (
      <div className="rounded-xl border border-border p-6">
        <p role="status">
          Ainda não há opções publicadas para reservas online. Consulte o
          atendimento da locadora.
        </p>
        <Link href="/contato" className="mt-4 inline-block underline">
          Ver atendimento
        </Link>
      </div>
    );
  return (
    <div className="space-y-8">
      {message && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4"
        >
          {message}
        </p>
      )}
      <form
        onSubmit={calculate}
        className="rounded-2xl border border-border bg-white p-5 sm:p-8"
      >
        <h2 className="text-2xl font-semibold">1. Sua viagem</h2>
        <fieldset
          disabled={busy}
          className="mt-6 space-y-5"
          onChange={() => setQuote(null)}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            {vehicle ? (
              <div className="sm:col-span-2">
                <p>
                  Veículo selecionado: {vehicle.make} {vehicle.model}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setVehicle(null);
                    setQuote(null);
                  }}
                >
                  Escolher por categoria
                </Button>
              </div>
            ) : (
              <>
                {[
                  ["branch_id", "Unidade", session.options.branches],
                  ["category_id", "Categoria", session.options.categories],
                ].map(([name, label, options]) => (
                  <label key={String(name)}>
                    {String(label)}
                    <select name={String(name)} required className={field}>
                      <option value="">Selecione</option>
                      {(options as Option[]).map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </>
            )}
            <label>
              Plano e fuso dos horários
              <select name="rate_plan_id" required className={field}>
                <option value="">Selecione</option>
                {session.options.plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.timezone}
                  </option>
                ))}
              </select>
            </label>
            {[
              ["start_at", "Data e hora da retirada"],
              ["end_at", "Data e hora da devolução"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="datetime-local"
                  name={key}
                  required
                  className={field}
                />
              </label>
            ))}
            <label>
              Retirada
              <select
                value={pickup}
                className={field}
                onChange={(e) => setPickup(e.target.value)}
              >
                <option value="BRANCH">Na unidade</option>
                <option value="DELIVERY">Entrega no endereço</option>
              </select>
            </label>
            <label>
              Devolução
              <select
                value={back}
                className={field}
                onChange={(e) => setBack(e.target.value)}
              >
                <option value="BRANCH">Na unidade</option>
                <option value="COLLECTION">Coleta no endereço</option>
              </select>
            </label>
          </div>
          {pickup === "DELIVERY" && (
            <AddressFields prefix="pickup" title="Endereço de entrega" />
          )}
          {back === "COLLECTION" && (
            <AddressFields prefix="return" title="Endereço de coleta" />
          )}
          <fieldset>
            <legend className="font-semibold">Adicionais</legend>
            {!session.options.services.length && (
              <p className="mt-2 text-sm">
                Nenhum serviço adicional publicado.
              </p>
            )}
            {session.options.services.map((s) => (
              <div
                key={s.id}
                className="my-3 flex flex-wrap items-center gap-3"
              >
                <label>
                  <input
                    type="checkbox"
                    checked={services.includes(s.id)}
                    onChange={(e) =>
                      setServices((old) =>
                        e.target.checked
                          ? [...old, s.id]
                          : old.filter((v) => v !== s.id),
                      )
                    }
                  />{" "}
                  {s.name} · {s.amount ? formatBRL(s.amount) : ""} / {s.unit}
                </label>
                {services.includes(s.id) && (
                  <label>
                    Quantidade de {s.name}
                    <input
                      type="number"
                      name={`qty_${s.id}`}
                      required
                      min={1}
                      max={100}
                      defaultValue={1}
                      className={field}
                    />
                  </label>
                )}
              </div>
            ))}
          </fieldset>
          <label className="block">
            Instruções de entrega/coleta (opcional)
            <textarea name="instructions" maxLength={500} className={field} />
          </label>
          <Honeypot />
          <Challenge
            siteKey={session.site_key}
            action="quote"
            onToken={setCaptcha}
            reset={reset}
          />
          <Button disabled={busy || !captcha} type="submit">
            {busy ? "Calculando…" : "Calcular minha cotação"}
          </Button>
        </fieldset>
      </form>
      {quote && (
        <section className="rounded-2xl border border-border bg-white p-5 sm:p-8">
          <h2 className="text-2xl font-semibold">2. Confira a cotação</h2>
          <ul className="my-5 space-y-3">
            {quote.items.map((line, index) => (
              <li key={index} className="flex justify-between gap-3">
                <span>
                  {line.description} · {line.quantity}
                </span>
                <strong>{formatBRL(line.total)}</strong>
              </li>
            ))}
          </ul>
          <p role="status" className="text-xl font-bold">
            Total: {formatBRL(quote.total)}
          </p>
          <p className="mt-2">Caução separada: {formatBRL(quote.deposit)}</p>
          <p className="mt-3">
            Disponibilidade indicativa: {quote.available ?? "a confirmar"}{" "}
            veículo(s). Sua solicitação depende de aprovação.
          </p>
          <p className="mt-2 text-sm">
            Validade: {new Date(quote.expires_at).toLocaleString("pt-BR")} no
            fuso do seu dispositivo. Pagamento na retirada, conforme as
            condições aprovadas.
          </p>
          <form onSubmit={request} className="mt-8">
            <h2 className="text-2xl font-semibold">
              3. Seus dados e solicitação
            </h2>
            <fieldset disabled={busy} className="mt-5 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <label>
                  Tipo de pessoa
                  <select name="person_type" className={field}>
                    <option value="PF">Pessoa física</option>
                    <option value="PJ">Pessoa jurídica</option>
                  </select>
                </label>
                {[
                  ["name", "Nome completo ou razão social", "text"],
                  ["tax_document", "CPF ou CNPJ", "text"],
                  ["email", "E-mail", "email"],
                  ["phone", "Telefone com DDD", "tel"],
                  [
                    "birth_date",
                    "Nascimento (opcional; somente pessoa física)",
                    "date",
                  ],
                ].map(([name, label, type]) => (
                  <label key={name}>
                    {label}
                    <input
                      name={name}
                      type={type}
                      required={name !== "birth_date"}
                      maxLength={200}
                      className={field}
                    />
                  </label>
                ))}
              </div>
              <AddressFields prefix="customer" title="Endereço do cliente" />
              <label className="block">
                <input name="accepted" type="checkbox" required /> Li e aceito
                as{" "}
                <Link
                  className="underline"
                  href="/politicas"
                  target="_blank"
                  rel="noreferrer"
                >
                  condições de locação e a política de privacidade
                </Link>
                , versão {session.site.terms_version.slice(0, 8)}.
              </label>
              <p className="text-sm">
                Os dados são declarados e serão conferidos pelo atendimento. Não
                envie documentos por este formulário.
              </p>
              <Honeypot />
              <Challenge
                siteKey={session.site_key}
                action="reservation"
                onToken={setRequestCaptcha}
                reset={reset}
              />
              <Button
                type="submit"
                disabled={busy || !requestCaptcha || quote.available === 0}
              >
                {busy ? "Enviando…" : "Solicitar reserva para análise"}
              </Button>
            </fieldset>
          </form>
        </section>
      )}
    </div>
  );
}
