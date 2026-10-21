import { afterEach, describe, expect, it, vi } from "vitest";
import { financeCommandSchema, positiveMoney } from "@/lib/finance/schema";
import { maintenanceCommandSchema } from "@/lib/maintenance/schema";
import { notificationSetupSchema } from "@/lib/notifications/schema";
import { signedCents, signedDecimal, netMoney } from "@/lib/finance/money";
import { csvCell, reportCsv } from "@/lib/reports/csv";
import { periodBounds, periodSchema } from "@/lib/reports/schema";
import { businessDate } from "@/lib/business/format";
const id = "f8000000-0000-4000-8000-000000000001";
afterEach(() => vi.unstubAllEnvs());
describe("financeiro, manutenção e relatórios", () => {
  it("datas de tela respeitam o fuso configurado sem deslocar datas civis", () => {
    vi.stubEnv("APP_TIMEZONE", "America/Fortaleza");
    expect(businessDate("2026-10-20T02:00:00Z")).toBe("19/10/2026, 23:00");
    vi.stubEnv("APP_TIMEZONE", "Asia/Tokyo");
    expect(businessDate("2026-10-20T02:00:00Z")).toBe("20/10/2026, 11:00");
    expect(businessDate("2026-10-20")).toBe("20/10/2026");
  });
  it("valores canônicos positivos e precisão em centavos, inclusive estornos", () => {
    for (const value of ["0.00", "-1.00", "1.001", "01.00", "1e2", 1])
      expect(positiveMoney.safeParse(value).success).toBe(false);
    expect(positiveMoney.parse("1,00")).toBe("1.00");
    expect(signedCents("9999999999.99")).toBe(999999999999n);
    expect(signedDecimal(-1n)).toBe("-0.01");
    expect(
      netMoney(
        { amount: "0.30" },
        { amount: "0.10", subtract: true },
        { amount: "0.20", subtract: true },
      ),
    ).toBe("0.00");
    expect(
      netMoney({ amount: "1.00" }, { amount: "2.01", subtract: true }),
    ).toBe("-1.01");
  });
  it("não presume recebimento e rejeita alocações repetidas ou acima do total", () => {
    const input = {
      action: "PAYMENT",
      customer_id: id,
      payment_method_id: id,
      amount: "10.00",
      received: true,
      allocations: [],
    };
    expect(financeCommandSchema.safeParse(input).success).toBe(true);
    expect(
      financeCommandSchema.safeParse({ ...input, received: false }).success,
    ).toBe(false);
    expect(
      financeCommandSchema.safeParse({
        ...input,
        allocations: [{ charge_id: id, amount: "10.01" }],
      }).success,
    ).toBe(false);
    expect(
      financeCommandSchema.safeParse({
        ...input,
        allocations: [
          { charge_id: id, amount: "1.00" },
          { charge_id: id, amount: "1.00" },
        ],
      }).success,
    ).toBe(false);
    expect(
      financeCommandSchema.safeParse({ ...input, card_number: "123" }).success,
    ).toBe(false);
  });
  it("reembolso vincula exatamente uma origem e exige confirmação de desembolso", () => {
    const input = {
      action: "REFUND",
      payment_id: id,
      deposit_id: null,
      allocation_id: id,
      amount: "1.00",
      payment_method_id: id,
      reason: "Restituição real confirmada",
      paid_out: true,
    };
    expect(financeCommandSchema.safeParse(input).success).toBe(true);
    for (const patch of [
      { paid_out: false },
      { deposit_id: id },
      { payment_id: null },
      { payment_id: null, deposit_id: id },
    ])
      expect(
        financeCommandSchema.safeParse({ ...input, ...patch }).success,
      ).toBe(false);
  });
  it("manutenção exige período ordenado, versão e km coerente", () => {
    const input = {
      action: "CREATE",
      vehicle_id: id,
      kind: "OIL",
      mileage: 0,
      start_at: "2026-10-20T10:00:00Z",
      end_at: "2026-10-20T12:00:00Z",
      blocks_availability: true,
      description: "Troca de óleo e filtro",
    };
    expect(maintenanceCommandSchema.safeParse(input).success).toBe(true);
    expect(
      maintenanceCommandSchema.safeParse({ ...input, end_at: input.start_at })
        .success,
    ).toBe(false);
    expect(
      maintenanceCommandSchema.safeParse({
        action: "START",
        maintenance_id: id,
      }).success,
    ).toBe(false);
    expect(
      maintenanceCommandSchema.safeParse({
        action: "COMPLETE",
        maintenance_id: id,
        expected_version: 1,
        mileage: 100,
        next_due_on: null,
        next_due_mileage: 99,
        expense: null,
      }).success,
    ).toBe(false);
  });
  it("CSV escapa conteúdo e neutraliza fórmulas após espaços e controles", () => {
    for (const value of [
      "=SUM(A1:A2)",
      " +1",
      "\u0001@x",
      "-2",
      "\tplain",
      "\nplain",
    ])
      expect(csvCell(value)).toBe(`"'${value}"`);
    expect(csvCell('texto;"citado"')).toBe('"texto;""citado"""');
    expect(
      reportCsv(
        [{ amount: "1.00", description: "=cmd" }],
        ["amount", "description"],
      ),
    ).toBe('\uFEFF"amount";"description"\r\n"1.00";"\'=cmd"\r\n');
  });
  it("relatório usa datas civis inclusivas e fuso, inclusive horário de verão", () => {
    vi.stubEnv("APP_TIMEZONE", "America/Sao_Paulo");
    expect(periodBounds({ from: "2018-11-04", to: "2018-11-04" })).toEqual({
      from_at: "2018-11-04T03:00:00Z",
      to_at: "2018-11-05T02:00:00Z",
    });
    expect(
      periodSchema.safeParse({ from: "2024-01-01", to: "2024-12-31" }).success,
    ).toBe(true);
    expect(
      periodSchema.safeParse({ from: "2024-01-01", to: "2025-01-01" }).success,
    ).toBe(false);
    expect(
      periodSchema.safeParse({ from: "2026-10-20", to: "2026-10-19" }).success,
    ).toBe(false);
  });
  it("templates permitem só variáveis mínimas e rotas coerentes", () => {
    const template = {
      kind: "TEMPLATE",
      name: "customer_update",
      version: 1,
      channel: "EMAIL",
      subject: "Registro {reference}",
      body: "Situação atual: {status} em {date}",
    };
    expect(notificationSetupSchema.safeParse(template).success).toBe(true);
    expect(
      notificationSetupSchema.safeParse({
        ...template,
        body: "Documento: {cpf}",
      }).success,
    ).toBe(false);
    expect(
      notificationSetupSchema.safeParse({
        ...template,
        subject: "Header\r\nBcc: test",
      }).success,
    ).toBe(false);
    expect(
      notificationSetupSchema.safeParse({
        kind: "ROUTE",
        event_type: "finance.payment",
        channel: "EMAIL",
        target: "CUSTOMER",
        template_id: id,
        enabled: true,
        expected_updated_at: null,
      }).success,
    ).toBe(false);
  });
});
