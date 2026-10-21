import { describe, it, expect } from "vitest";
import fixture from "../fixtures/pricing.json";
import { calculateQuote } from "@/lib/pricing/engine";
import {
  policySchema,
  planInputSchema,
  priceInputSchema,
  moneySchema,
} from "@/lib/pricing/policy";
import { bookingInputSchema, catalogSchema } from "@/lib/reservations/schema";
import {
  MAX_CENTS,
  cents,
  decimal,
  formatBRL,
  roundFraction,
} from "@/lib/pricing/money";
import { lookupToken, tokenHash } from "@/lib/reservations/token";
import type { BookingInput, PricingCatalog } from "@/lib/reservations/schema";
const input = bookingInputSchema.parse(fixture.input);
function catalog(
  patch: Partial<PricingCatalog["plan"]> = {},
  policy: Record<string, unknown> = {},
) {
  return catalogSchema.parse({
    fingerprint: "a".repeat(64),
    revision: 1,
    plan: {
      id: input.rate_plan_id,
      name: "Apenas teste",
      version: 1,
      period_unit: "DAY",
      month_mode: null,
      commercial_month_days: null,
      ...patch,
      policy: { ...fixture.policy, ...policy },
    },
    price: {
      id: "f5000000-0000-4000-8000-000000000004",
      amount: "100.00",
      scope: "CATEGORY",
    },
    addons: [],
  });
}
const auth = { canDiscount: true, roles: ["MANAGER"] };
const calculate = (
  end: string,
  c = catalog(),
  patch: Partial<BookingInput> = {},
) => calculateQuote({ ...input, end_at: end, ...patch }, c, auth);
describe("motor de preço com centavos inteiros e regras explícitas", () => {
  it("normaliza dinheiro, rejeita excesso e arredonda frações sem ponto flutuante", () => {
    expect(moneySchema.parse("10,5")).toBe("10.50");
    expect(() => cents("1e3")).toThrow();
    expect(decimal(MAX_CENTS)).toBe("9999999999.99");
    expect(() => decimal(MAX_CENTS + 1n)).toThrow();
    expect(formatBRL("1000000.05")).toBe("R$ 1.000.000,05");
    expect(roundFraction(5n, 2n, "HALF_UP")).toBe(3n);
    expect(roundFraction(5n, 2n, "TRUNCATE")).toBe(2n);
    expect(roundFraction(1n, 4n, "CEIL")).toBe(1n);
  });
  it("cobra duas diárias e mantém caução fora do total", () => {
    const q = calculate(input.end_at);
    expect(q.total).toBe("200.00");
    expect(q.deposit).toBe("500.00");
    expect(q.lines[0].quantity).toBe("2.0000");
  });
  it("aceita fronteira exata de tolerância; minuto seguinte cobra período", () => {
    expect(calculate("2030-01-03T12:30:00Z").total).toBe("200.00");
    expect(calculate("2030-01-03T12:30:00.001Z").total).toBe("300.00");
    expect(calculate("2030-01-03T12:30:00Z").summary.grace_applied).toBe(true);
  });
  it("mínimo é configurado; não inventa preço fracionário em período curto", () => {
    expect(
      calculate("2030-01-01T13:00:00Z", catalog({}, { minimum_periods: 2 }))
        .total,
    ).toBe("200.00");
  });
  it("dia mais hora usa incrementos e arredondamento de cada linha", () => {
    const q = calculate(
      "2030-01-02T12:31:00Z",
      catalog({}, { strategy: "DAY_HOUR" }),
    );
    expect(q.total).toBe("107.50");
    expect(q.lines[1].quantity).toBe("0.7500");
    expect(
      calculate(
        "2030-01-02T12:00:01Z",
        catalog(
          {},
          { strategy: "DAY_HOUR", tolerance_minutes: 0, hour_amount: "0.01" },
        ),
      ).total,
    ).toBe("100.00");
    expect(
      calculate(
        "2030-01-02T12:00:01Z",
        catalog(
          {},
          {
            strategy: "DAY_HOUR",
            tolerance_minutes: 0,
            hour_amount: "0.01",
            rounding: "CEIL",
          },
        ),
      ).total,
    ).toBe("100.01");
  });
  it("pacote mensal combina semanas, dias e horas sem mudar regras", () => {
    const c = catalog(
      {
        period_unit: "MONTH",
        month_mode: "COMMERCIAL",
        commercial_month_days: 30,
      },
      { strategy: "WEEK_DAY_HOUR", tolerance_minutes: 0 },
    );
    c.price.amount = "2000.00";
    const q = calculate("2030-02-10T13:00:00Z", c);
    expect(q.lines.map((l) => l.total)).toEqual([
      "2000.00",
      "600.00",
      "300.00",
      "10.00",
    ]);
    expect(q.total).toBe("2910.00");
  });
  it("mês calendário ancora o dia original em fevereiro bissexto e retorna a março", () => {
    const c = catalog({ period_unit: "MONTH", month_mode: "CALENDAR" });
    expect(
      calculate("2024-02-29T12:00:00Z", c, { start_at: "2024-01-31T12:00:00Z" })
        .total,
    ).toBe("100.00");
    expect(
      calculate("2024-03-31T12:00:00Z", c, { start_at: "2024-01-31T12:00:00Z" })
        .total,
    ).toBe("200.00");
    expect(
      calculate("2025-02-28T12:00:00Z", c, { start_at: "2025-01-31T12:00:00Z" })
        .total,
    ).toBe("100.00");
  });
  it("mês comercial usa a quantidade explicitamente configurada", () => {
    expect(
      calculate(
        "2030-01-31T12:00:00Z",
        catalog({
          period_unit: "MONTH",
          month_mode: "COMMERCIAL",
          commercial_month_days: 30,
        }),
      ).total,
    ).toBe("100.00");
    expect(
      calculate(
        "2030-01-31T12:00:00Z",
        catalog({
          period_unit: "MONTH",
          month_mode: "COMMERCIAL",
          commercial_month_days: 28,
        }),
      ).total,
    ).toBe("200.00");
  });
  it("dias locais e 24 horas divergem na volta do horário de verão", () => {
    const patch = { start_at: "2024-11-02T12:00:00-04:00" };
    expect(
      calculate(
        "2024-11-03T12:00:00-05:00",
        catalog(
          {},
          {
            timezone: "America/New_York",
            duration_basis: "LOCAL_DAYS",
            tolerance_minutes: 0,
          },
        ),
        patch,
      ).total,
    ).toBe("100.00");
    expect(
      calculate(
        "2024-11-03T12:00:00-05:00",
        catalog(
          {},
          {
            timezone: "America/New_York",
            duration_basis: "ELAPSED",
            tolerance_minutes: 0,
          },
        ),
        patch,
      ).total,
    ).toBe("200.00");
  });
  it("adicionais seguem duração real e logística cobra taxas fixas separadas", () => {
    const c = catalog();
    const id = "f5000000-0000-4000-8000-000000000005";
    c.addons = [{ id, name: "Serviço teste", unit: "DAY", amount: "5.00" }];
    const address = {
      postal_code: "60000000",
      street: "Teste",
      number: "1",
      district: "Centro",
      city: "Fortaleza",
      state: "CE" as const,
      complement: null,
    };
    const q = calculate("2030-01-03T12:10:00Z", c, {
      additional_services: [{ id, quantity: 2 }],
      pickup_mode: "DELIVERY",
      return_mode: "COLLECTION",
      pickup_address: address,
      return_address: address,
    });
    expect(q.total).toBe("280.00");
    expect(q.summary.services).toBe("30.00");
    expect(q.lines.map((l) => l.kind)).toEqual([
      "RENTAL",
      "SERVICE",
      "DELIVERY",
      "COLLECTION",
    ]);
    expect(() =>
      calculate(input.end_at, catalog({}, { delivery_enabled: false }), {
        pickup_mode: "DELIVERY",
        pickup_address: address,
      }),
    ).toThrow("Entrega");
  });
  it("desconto exige cargo, permissão, motivo e limite; logística e caução ficam fora da base", () => {
    expect(
      calculate(input.end_at, catalog(), {
        discount_amount: "20.00",
        discount_reason: "Acordo teste",
      }).total,
    ).toBe("180.00");
    expect(() =>
      calculate(input.end_at, catalog(), {
        discount_amount: "20.01",
        discount_reason: "Acordo teste",
      }),
    ).toThrow("limite");
    expect(() =>
      calculateQuote(
        { ...input, discount_amount: "1.00", discount_reason: "Acordo teste" },
        catalog(),
        { canDiscount: false, roles: ["ADMIN"] },
      ),
    ).toThrow("autorizado");
    expect(() =>
      calculateQuote(
        { ...input, discount_amount: "1.00", discount_reason: "Acordo teste" },
        catalog(),
        { canDiscount: true, roles: ["ATTENDANT"] },
      ),
    ).toThrow("autorizado");
  });
  it("rejeita overflow, períodos inválidos, plano divergente e serviço desconhecido", () => {
    const c = catalog();
    c.price.amount = "9999999999.99";
    expect(() => calculate(input.end_at, c)).toThrow("limites");
    expect(() => calculate(input.start_at)).toThrow("Período");
    expect(() =>
      calculate(input.end_at, catalog(), {
        rate_plan_id: "f5000000-0000-4000-8000-000000000099",
      }),
    ).toThrow("divergente");
    expect(() =>
      calculate(input.end_at, catalog(), {
        additional_services: [{ id: input.branch_id, quantity: 1 }],
      }),
    ).toThrow("indisponível");
  });
  it("configuração incompleta ou ambígua bloqueia cotação e não lança fora do safeParse", () => {
    expect(policySchema.safeParse({}).success).toBe(false);
    expect(
      policySchema.safeParse({
        ...fixture.policy,
        strategy: "DAY_HOUR",
        day_amount: null,
      }).success,
    ).toBe(false);
    const { engine: _, ...policy } = fixture.policy;
    void _;
    const plan = {
      ...policy,
      name: "Teste",
      period_unit: "DAY",
      month_mode: "",
      commercial_month_days: undefined,
      active: true,
    };
    expect(planInputSchema.parse(plan).policy.engine).toBe("v1");
    expect(
      planInputSchema.safeParse({
        ...plan,
        strategy: "DAY_HOUR",
        hour_amount: "",
      }).success,
    ).toBe(false);
    expect(
      planInputSchema.safeParse({ ...plan, period_unit: "MONTH" }).success,
    ).toBe(false);
    expect(
      priceInputSchema.safeParse({
        name: "Teste",
        rate_plan_id: input.rate_plan_id,
        category_id: input.category_id,
        vehicle_id: input.branch_id,
        valid_from: input.start_at,
        valid_to: input.end_at,
        amount: "100",
      }).success,
    ).toBe(false);
  });
  it("payload não aceita total, política, serviços repetidos ou logística sem endereço", () => {
    expect(
      bookingInputSchema.safeParse({ ...input, total: "1.00" }).success,
    ).toBe(false);
    expect(
      bookingInputSchema.safeParse({ ...input, pickup_mode: "DELIVERY" })
        .success,
    ).toBe(false);
    expect(
      bookingInputSchema.safeParse({
        ...input,
        additional_services: [
          { id: input.branch_id, quantity: 1 },
          { id: input.branch_id, quantity: 1 },
        ],
      }).success,
    ).toBe(false);
  });
  it("token opaco repete somente no mesmo pedido e só seu hash é armazenável", () => {
    const token = lookupToken("s".repeat(32), "ator", "cotação", "chave");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(lookupToken("s".repeat(32), "ator", "cotação", "chave")).toBe(token);
    expect(lookupToken("s".repeat(32), "outro", "cotação", "chave")).not.toBe(
      token,
    );
    expect(tokenHash(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash(token)).not.toContain(token);
  });
});
