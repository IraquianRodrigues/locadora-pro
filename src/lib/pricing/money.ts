export const MAX_CENTS = 999999999999n;
export function cents(value: string): bigint {
  if (!/^(0|[1-9][0-9]{0,9})\.[0-9]{2}$/.test(value))
    throw new Error("Valor monetário inválido.");
  const result = BigInt(value.replace(".", ""));
  if (result > MAX_CENTS) throw new Error("Valor monetário acima do limite.");
  return result;
}
export function decimal(value: bigint): string {
  if (value < 0n || value > MAX_CENTS)
    throw new Error("Total fora dos limites monetários.");
  return `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
}
export function roundFraction(
  value: bigint,
  denominator: bigint,
  mode: "HALF_UP" | "CEIL" | "TRUNCATE",
) {
  if (value < 0n || denominator <= 0n)
    throw new Error("Fração monetária inválida.");
  const whole = value / denominator,
    rest = value % denominator;
  return (
    whole +
    (mode === "CEIL"
      ? rest > 0n
        ? 1n
        : 0n
      : mode === "HALF_UP" && rest * 2n >= denominator
        ? 1n
        : 0n)
  );
}
export function formatBRL(value: string) {
  const [whole, fraction] = decimal(cents(value)).split(".");
  return `R$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}`;
}
