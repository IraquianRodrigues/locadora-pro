import { Temporal } from "@js-temporal/polyfill";
import { cents, decimal, roundFraction } from "./money";
import type { BookingInput, PricingCatalog } from "@/lib/reservations/schema";

type Unit = "DAY" | "WEEK" | "MONTH";
export type QuoteLine = {
  kind: "RENTAL" | "SERVICE" | "DELIVERY" | "COLLECTION" | "DISCOUNT";
  description: string;
  quantity: string;
  unit_amount: string;
  total: string;
  additional_service_id: string | null;
  snapshot: Record<string, unknown>;
};
export function calculateQuote(
  input: BookingInput,
  catalog: PricingCatalog,
  authorization: { canDiscount: boolean; roles: string[] },
) {
  const { plan, price } = catalog,
    policy = plan.policy;
  const start = Temporal.Instant.from(input.start_at).toZonedDateTimeISO(
    policy.timezone,
  );
  const end = Temporal.Instant.from(input.end_at).toZonedDateTimeISO(
    policy.timezone,
  );
  const elapsed = end.epochMilliseconds - start.epochMilliseconds;
  if (elapsed <= 0 || elapsed > 3660 * 86400000)
    throw new Error("Período inválido.");
  if (input.rate_plan_id !== plan.id)
    throw new Error("Plano de cotação divergente.");
  function advance(
    origin: Temporal.ZonedDateTime,
    unit: Unit,
    n: number,
  ): Temporal.ZonedDateTime {
    if (unit === "MONTH") {
      if (plan.month_mode === "CALENDAR")
        return origin.add({ months: n }, { overflow: "constrain" });
      if (plan.month_mode !== "COMMERCIAL" || !plan.commercial_month_days)
        throw new Error("Modo mensal não configurado.");
    }
    const days =
      n *
      (unit === "WEEK"
        ? 7
        : unit === "MONTH"
          ? plan.commercial_month_days!
          : 1);
    return policy.duration_basis === "ELAPSED"
      ? origin.add({ hours: days * 24 })
      : origin.add({ days });
  }
  function floorPeriods(
    origin: Temporal.ZonedDateTime,
    until: Temporal.ZonedDateTime,
    unit: Unit,
  ) {
    let low = 0,
      high = 100001;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (
        advance(origin, unit, middle).epochMilliseconds <=
        until.epochMilliseconds
      )
        low = middle;
      else high = middle;
    }
    return low;
  }
  const lines: QuoteLine[] = [];
  function add(
    kind: QuoteLine["kind"],
    description: string,
    amount: string,
    numerator: number,
    denominator = 1,
    snapshot: Record<string, unknown> = {},
    addonId: string | null = null,
  ) {
    if (
      !Number.isSafeInteger(numerator) ||
      numerator <= 0 ||
      ![1, 60].includes(denominator)
    )
      throw new Error("Quantidade inválida.");
    const total = roundFraction(
      cents(amount) * BigInt(numerator),
      BigInt(denominator),
      policy.rounding,
    );
    const scaled = (BigInt(numerator) * 10000n) / BigInt(denominator);
    lines.push({
      kind,
      description,
      quantity: `${scaled / 10000n}.${(scaled % 10000n).toString().padStart(4, "0")}`,
      unit_amount: amount,
      total: decimal(total),
      additional_service_id: addonId,
      snapshot,
    });
  }
  let periods = Math.max(
    policy.minimum_periods,
    floorPeriods(start, end, plan.period_unit),
  );
  let cursor = advance(start, plan.period_unit, periods);
  const extra = end.epochMilliseconds - cursor.epochMilliseconds;
  const graceApplied = extra > 0 && extra <= policy.tolerance_minutes * 60000;
  if (extra > 0 && !graceApplied && policy.strategy === "CEIL_PERIOD")
    periods++;
  add(
    "RENTAL",
    `${plan.name} · ${plan.period_unit}`,
    price.amount,
    periods,
    1,
    { unit: plan.period_unit, periods, price_id: price.id, scope: price.scope },
  );
  if (extra > 0 && !graceApplied && policy.strategy !== "CEIL_PERIOD") {
    if (policy.strategy === "WEEK_DAY_HOUR" && plan.period_unit === "MONTH") {
      const weeks = floorPeriods(cursor, end, "WEEK");
      if (weeks) {
        if (!policy.week_amount)
          throw new Error("Semana excedente não configurada.");
        add("RENTAL", "Semanas excedentes", policy.week_amount, weeks);
        cursor = advance(cursor, "WEEK", weeks);
      }
    }
    if (plan.period_unit !== "DAY") {
      const days = floorPeriods(cursor, end, "DAY");
      if (days) {
        if (!policy.day_amount)
          throw new Error("Diária excedente não configurada.");
        add("RENTAL", "Diárias excedentes", policy.day_amount, days);
        cursor = advance(cursor, "DAY", days);
      }
    }
    const remaining = end.epochMilliseconds - cursor.epochMilliseconds;
    if (remaining > 0) {
      if (!policy.hour_amount)
        throw new Error("Hora excedente não configurada.");
      const minutes =
        Math.ceil(remaining / (policy.hour_increment_minutes * 60000)) *
        policy.hour_increment_minutes;
      add("RENTAL", "Horas excedentes", policy.hour_amount, minutes, 60, {
        charged_minutes: minutes,
        increment_minutes: policy.hour_increment_minutes,
      });
    }
  }
  const rental = lines.reduce((sum, line) => sum + cents(line.total), 0n);
  let services = 0n;
  for (const selected of input.additional_services) {
    const service = catalog.addons.find((a) => a.id === selected.id);
    if (!service) throw new Error("Serviço adicional indisponível.");
    let units = 1;
    if (service.unit === "HOUR") units = Math.ceil(elapsed / 3600000);
    else if (service.unit !== "ONCE") {
      const whole = floorPeriods(start, end, service.unit);
      units =
        whole +
        (advance(start, service.unit, whole).epochMilliseconds <
        end.epochMilliseconds
          ? 1
          : 0);
    }
    add(
      "SERVICE",
      service.name,
      service.amount,
      units * selected.quantity,
      1,
      {
        unit: service.unit,
        units,
        selected_quantity: selected.quantity,
        basis: "ACTUAL_DURATION",
      },
      service.id,
    );
    services += cents(lines[lines.length - 1].total);
  }
  if (input.pickup_mode === "DELIVERY") {
    if (!policy.delivery_enabled)
      throw new Error("Entrega não habilitada neste plano.");
    add("DELIVERY", "Taxa de entrega", policy.delivery_amount, 1);
  }
  if (input.return_mode === "COLLECTION") {
    if (!policy.collection_enabled)
      throw new Error("Coleta não habilitada neste plano.");
    add("COLLECTION", "Taxa de coleta", policy.collection_amount, 1);
  }
  const discount = cents(input.discount_amount),
    base = policy.discount_scope === "RENTAL" ? rental : rental + services;
  if (discount > 0n) {
    const limit = Math.max(
      authorization.roles.includes("ADMIN") ? policy.admin_discount_bps : 0,
      authorization.roles.includes("MANAGER") ? policy.manager_discount_bps : 0,
    );
    if (
      !authorization.canDiscount ||
      discount * 10000n > base * BigInt(limit) ||
      input.discount_reason.length < 5
    )
      throw new Error(
        "Desconto não autorizado ou acima do limite configurado.",
      );
    add("DISCOUNT", "Desconto autorizado", input.discount_amount, 1, 1, {
      reason: input.discount_reason,
      scope: policy.discount_scope,
      limit_bps: limit,
    });
  }
  const total = lines.reduce(
    (sum, line) =>
      sum + (line.kind === "DISCOUNT" ? -cents(line.total) : cents(line.total)),
    0n,
  );
  return {
    engine: "v1" as const,
    total: decimal(total),
    deposit: policy.deposit_amount,
    lines,
    summary: {
      rental: decimal(rental),
      services: decimal(services),
      discount: decimal(discount),
      grace_applied: graceApplied,
      duration_basis: policy.duration_basis,
      elapsed_milliseconds: elapsed,
    },
  };
}
