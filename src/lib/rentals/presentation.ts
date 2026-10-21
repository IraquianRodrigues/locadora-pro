import { formatBRL } from "@/lib/pricing/money";

// PostgREST pode retornar numeric como 0 ou 0.5. Completa a escala sem usar ponto flutuante.
export function rentalMoney(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return formatBRL(`${whole}.${fraction.padEnd(2, "0")}`);
}
