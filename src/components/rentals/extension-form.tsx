"use client";
import { useRef, useState } from "react";
import type { RentalView } from "@/lib/rentals/service";
import type { QuoteView } from "@/lib/reservations/service";
import { quoteAction } from "@/lib/reservations/actions";
import { QuoteSummary } from "@/components/reservations/quote-summary";
import { OperationForm, control } from "./operation-form";
import { Button } from "@/components/ui/button";
import { localBookingInstant } from "@/lib/public/dates";
import { bookingDate } from "@/lib/reservations/labels";
export function ExtensionForm({
  r,
  plans,
}: {
  r: RentalView;
  plans: { id: string; name: string }[];
}) {
  const [quote, setQuote] = useState<QuoteView | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    attempt = useRef<{ payload: string; key: string } | null>(null);
  return (
    <section className="rental-section">
      <h2>Prorrogar locação</h2>
      <p className="rental-prose">
        O novo período começa em {bookingDate(r.end_at)} (Fortaleza). Use um
        plano sem nova caução; a garantia original permanece. A disponibilidade
        será validada ao confirmar. Aditivo em PDF e cobrança serão registrados
        junto com a prorrogação.
      </p>
      <form
        className="rental-extension-form"
        aria-label="Cotar prorrogação"
        aria-busy={busy}
        onChange={() => setQuote(null)}
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          try {
            const f = new FormData(e.currentTarget),
              input = {
                rate_plan_id: String(f.get("plan")),
                branch_id: r.branch_id,
                vehicle_id: r.vehicle_id,
                category_id: null,
                customer_id: r.customer_id,
                start_at: r.end_at,
                end_at: localBookingInstant(
                  String(f.get("end")),
                  "America/Fortaleza",
                ),
                additional_services: [],
                pickup_mode: "BRANCH",
                return_mode: "BRANCH",
                pickup_address: null,
                return_address: null,
                instructions: "Prorrogação",
                discount_amount: "0.00",
                discount_reason: "",
              };
            const payload = JSON.stringify(input);
            if (attempt.current?.payload !== payload)
              attempt.current = { payload, key: crypto.randomUUID() };
            const result = await quoteAction(input, attempt.current!.key);
            if (result.ok) {
              setQuote(result.quote);
              setMessage("");
            } else setMessage(result.message);
          } catch {
            setMessage(
              "Não foi possível cotar. Confira a data e tente novamente.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="form-grid">
          <label className="field-label">
            Plano de prorrogação
            <select name="plan" required className={control}>
              <option value="">Escolha</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Nova data e hora de devolução
            <input
              className={control}
              name="end"
              type="datetime-local"
              aria-describedby="extension-timezone"
              required
            />
          </label>
          <p id="extension-timezone" className="field-help form-span">
            Horário de Fortaleza. Informe uma data posterior à devolução
            prevista.
          </p>
          <div className="form-span">
            <Button>{busy ? "Calculando…" : "Cotar prorrogação"}</Button>
          </div>
        </fieldset>
      </form>
      {message && <p role="alert">{message}</p>}
      {quote && (
        <>
          <QuoteSummary quote={quote} />
          <OperationForm
            kind="extend"
            title="Confirmar prorrogação"
            build={() => ({ rental_id: r.id, quote_id: quote.id })}
          />
        </>
      )}
    </section>
  );
}
