export function dbMoney(value: unknown): string {
  const raw = typeof value === "number" ? value.toFixed(2) : String(value);
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw))
    throw new Error("Valor decimal inválido.");
  const [whole, fraction = ""] = raw.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}
export function signedCents(value: unknown) {
  const normalized = dbMoney(value);
  return BigInt(normalized.replace(".", ""));
}
export function signedDecimal(value: bigint) {
  const sign = value < 0n ? "-" : "",
    v = value < 0n ? -value : value;
  return `${sign}${v / 100n}.${String(v % 100n).padStart(2, "0")}`;
}
export function currency(value: unknown) {
  const normalized = dbMoney(value),
    [whole, fraction] = normalized.split(".");
  return `R$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}`;
}
export function netMoney(...values: { amount: unknown; subtract?: boolean }[]) {
  return signedDecimal(
    values.reduce(
      (sum, v) => sum + signedCents(v.amount) * (v.subtract ? -1n : 1n),
      0n,
    ),
  );
}
