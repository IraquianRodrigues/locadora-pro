import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { businessInstant, businessLocalValue } from "@/lib/business/dates";
import { businessDate } from "@/lib/business/format";
import { FinanceView } from "@/components/finance/finance-view";
import { ReportsView } from "@/components/reports/reports-view";
import { MaintenanceDetailView } from "@/components/maintenance/maintenance-view";
import {
  financeFixtureOptions,
  financeFixtureRows,
  maintenanceFixture,
  businessId,
  reportFixtureRows,
} from "../../scripts/preview/business-fixtures";
vi.mock("@/lib/business/actions", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh() {}, push() {} }),
}));
const timezone = "America/Fortaleza";
describe("gestão Apex na apresentação", () => {
  it("converte datas locais no fuso explícito sem depender do fuso da máquina", () => {
    expect(businessInstant("2026-10-21T09:00", timezone)).toBe(
      "2026-10-21T12:00:00Z",
    );
    expect(businessLocalValue("2026-10-21T12:00:00Z", timezone)).toBe(
      "2026-10-21T09:00",
    );
    expect(businessLocalValue("2026-10-21T12:00:00Z", "America/Manaus")).toBe(
      "2026-10-21T08:00",
    );
  });
  it("mantém datas civis e horário na apresentação conforme o fuso recebido", () => {
    expect(businessDate("2026-10-21", timezone)).toBe("21/10/2026");
    expect(businessDate("2026-10-21T12:00:00Z", "America/Manaus")).toContain(
      "08:00",
    );
  });
  it("recusa horários inexistentes ou ambíguos em mudança de horário de verão", () => {
    expect(() =>
      businessInstant("2026-03-08T02:30", "America/New_York"),
    ).toThrow();
    expect(() =>
      businessInstant("2026-11-01T01:30", "America/New_York"),
    ).toThrow();
  });
  it("não oferece lançamentos e ações financeiras a quem tem apenas consulta", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceView, {
        result: {
          rows: financeFixtureRows.CHARGES,
          page: 1,
          page_size: 20,
          total: 1,
        },
        options: financeFixtureOptions,
        filters: { kind: "CHARGES", page: 1 },
        query: "",
        permissions: ["finance.read"],
        timezone,
      }),
    );
    expect(html).toContain("R$ 1.300,00");
    expect(html).toContain("R$ 700,00");
    expect(html).not.toContain("Novo lançamento");
    expect(html).not.toContain("Receber nesta cobrança");
    expect(html).not.toContain("Meios e limites");
  });
  it("preserva caução, aplicações e saldo sem apresentar a aplicação como nova receita", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceView, {
        result: {
          rows: financeFixtureRows.DEPOSITS,
          page: 1,
          page_size: 20,
          total: 1,
        },
        options: financeFixtureOptions,
        filters: { kind: "DEPOSITS", page: 1 },
        query: "",
        permissions: ["deposits.manage"],
        timezone,
      }),
    );
    expect(html).toContain("R$ 1.000,00");
    expect(html).toContain("R$ 800,00");
    expect(html).toContain("não representa uma nova entrada de caixa");
    expect(html).not.toContain(
      "Confirmo que o dinheiro foi efetivamente devolvido",
    );
  });
  it("exporta só a página selecionada e preserva números assinados e filtros", () => {
    const html = renderToStaticMarkup(
      createElement(ReportsView, {
        filters: {
          kind: "RECEIPTS",
          from: "2026-10-01",
          to: "2026-10-31",
          page: 2,
          page_size: 50,
        },
        result: {
          kind: "RECEIPTS",
          rows: reportFixtureRows.RECEIPTS,
          page: 2,
          page_size: 50,
          total: 102,
        },
        allowed: ["RECEIPTS"],
        timezone,
      }),
    );
    expect(html).toContain("R$ -50,00");
    expect(html).toContain("page=2");
    expect(html).toContain("page_size=50");
    expect(html).toContain("2 linhas");
    expect(html).toContain("Cauções não entram");
  });
  it("explica os limites de resultado contratado e cobertura histórica", () => {
    for (const kind of ["PROFITABILITY", "OCCUPANCY"] as const) {
      const html = renderToStaticMarkup(
        createElement(ReportsView, {
          filters: {
            kind,
            from: "2026-10-01",
            to: "2026-10-31",
            page: 1,
            page_size: 50,
          },
          result: {
            kind,
            rows: reportFixtureRows[kind],
            page: 1,
            page_size: 50,
            total: 1,
          },
          allowed: [kind],
          timezone,
          preview: true,
        }),
      );
      expect(html).toContain(
        kind === "PROFITABILITY"
          ? "não equivale a lucro contábil"
          : "Cobertura histórica limitada",
      );
      expect(html).not.toContain("/api/v1/admin/reports/export");
    }
  });
  it("mantém serviço concluído sem comandos mesmo com permissão de escrita", () => {
    const html = renderToStaticMarkup(
      createElement(MaintenanceDetailView, {
        data: maintenanceFixture(businessId(3)),
        permissions: ["maintenance.write", "expenses.write", "finance.read"],
        methods: [],
        timezone,
      }),
    );
    expect(html).not.toContain("<form");
    expect(html).toContain("Serviço encerrado");
    expect(html).not.toContain("Abrir veículo");
    expect(html).toContain("Histórico");
  });
});
