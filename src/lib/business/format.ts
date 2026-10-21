import { parseTimezone } from "@/config/env";
export function businessTimezone() {
  return parseTimezone(process.env.APP_TIMEZONE);
}
export function businessDate(value: string, timezone = businessTimezone()) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return value.split("-").reverse().join("/");
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}
export const businessLabels: Record<string, string> = {
  MANUAL: "Cobrança manual",
  FINE: "Multa",
  RENTAL: "Locação",
  EXTENSION: "Prorrogação",
  DAMAGE: "Avaria",
  EXCESS: "Excedente",
  DISCOUNT: "Desconto",
  CANCEL: "Cancelamento",
  CORRECTION: "Correção",
  RECEIPT: "Recebimento",
  REFUND: "Reembolso",
  EXPENSE: "Despesa",
  REVERSAL: "Estorno",
  REQUESTED: "Solicitada",
  UNDER_REVIEW: "Em análise",
  CONFIRMED: "Confirmada",
  REJECTED: "Rejeitada",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
  CONVERTED: "Convertida em locação",
  PREPARING: "Em preparação",
  ACTIVE: "Ativa",
  OVERDUE: "Em atraso",
  COMPLETED: "Concluída",
  SCHEDULED: "Agendada",
  IN_PROGRESS: "Em execução",
  PREVENTIVE: "Preventiva",
  CORRECTIVE: "Corretiva",
  OIL: "Troca de óleo",
  TIRES: "Pneus",
  SERVICE: "Revisão",
};
