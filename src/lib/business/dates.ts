import { Temporal } from "@js-temporal/polyfill";
import { localBookingInstant } from "@/lib/public/dates";
export function businessInstant(value: string, timezone: string) {
  return localBookingInstant(value, timezone);
}
export function businessLocalValue(instant: string, timezone: string) {
  return Temporal.Instant.from(instant)
    .toZonedDateTimeISO(timezone)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}
