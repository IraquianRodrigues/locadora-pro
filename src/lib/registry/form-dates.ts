import { Temporal } from "@js-temporal/polyfill";
import { businessInstant } from "@/lib/business/dates";
export function priceLocalValue(instant: string, timezone: string) {
  return Temporal.Instant.from(instant)
    .toZonedDateTimeISO(timezone)
    .toPlainDateTime()
    .toString({ smallestUnit: "second" });
}
export function priceFormDefaults(
  defaults: Record<string, unknown>,
  timezone: string,
) {
  return {
    ...defaults,
    ...Object.fromEntries(
      ["valid_from", "valid_to"].map((key) => [
        key,
        defaults[key] ? priceLocalValue(String(defaults[key]), timezone) : "",
      ]),
    ),
  };
}
export function priceFormInput(
  values: Record<string, unknown>,
  timezone: string,
  original: Record<string, unknown>,
) {
  const input = { ...values };
  for (const key of ["valid_from", "valid_to"]) {
    const local = String(values[key] ?? "");
    try {
      input[key] =
        original[key] &&
        local === priceLocalValue(String(original[key]), timezone)
          ? original[key]
          : businessInstant(local, timezone);
    } catch {
      return { input, error: key };
    }
  }
  return { input, error: null };
}
