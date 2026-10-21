export const statusLabels: Record<string, string> = {
  REQUESTED: "Solicitada",
  UNDER_REVIEW: "Em análise",
  CONFIRMED: "Confirmada",
  REJECTED: "Rejeitada",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
  CONVERTED: "Convertida em locação",
};
export function bookingDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
  });
}
