import type { QuoteView } from "@/lib/reservations/service";
import { formatBRL } from "@/lib/pricing/money";
export function QuoteSummary({ quote }: { quote: QuoteView }) {
  return (
    <section
      className="quote-summary workspace-section"
      aria-label="Cotação congelada"
    >
      <h2>Cotação</h2>
      <ul className="quote-lines">
        {quote.quote_items.map((line) => (
          <li key={line.id}>
            <span>
              {line.description} · {line.quantity}
            </span>
            <strong>
              {line.kind === "DISCOUNT" ? "− " : ""}
              {formatBRL(line.total)}
            </strong>
          </li>
        ))}
      </ul>
      <dl className="quote-totals">
        <div>
          <dt>Total</dt>
          <dd>{formatBRL(quote.total)}</dd>
        </div>
        <div>
          <dt>Caução separada</dt>
          <dd>{formatBRL(quote.deposit)}</dd>
        </div>
      </dl>
      <p className="field-help">
        Cotação válida até{" "}
        {new Date(quote.expires_at).toLocaleString("pt-BR", {
          timeZone: "America/Fortaleza",
        })}{" "}
        (Fortaleza). A solicitação será analisada antes da confirmação.
      </p>
    </section>
  );
}
