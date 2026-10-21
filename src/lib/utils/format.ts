export function formatDate(value: Date, timezone = "America/Fortaleza") {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}
