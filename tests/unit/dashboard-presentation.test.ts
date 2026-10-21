import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildNavigation } from "@/lib/navigation";
import {
  DashboardView,
  type DashboardData,
} from "@/components/business/dashboard-view";

const render = (data: DashboardData, permissions: string[] = []) =>
  renderToStaticMarkup(
    createElement(DashboardView, {
      data,
      permissions,
      from: "2026-10-01",
      to: "2026-10-20",
    }),
  );

describe("apresentação do painel", () => {
  it("filtra destinos pela permissão exata, inclusive relatórios financeiros", () => {
    const links = (permissions: string[]) =>
      buildNavigation(permissions).flatMap((g) => g.items.map((i) => i.href));
    expect(links([])).toEqual(["/admin/dashboard", "/admin/notificacoes"]);
    expect(links(["vehicles.read", "reports.finance"])).toEqual([
      "/admin/dashboard",
      "/admin/frota",
      "/admin/relatorios",
      "/admin/notificacoes",
    ]);
    expect(links(["customers.write"])).not.toContain("/admin/clientes");
    expect(links(["finance.read"])).not.toContain("/admin/usuarios");
  });
  it("oferece criar reserva somente com a permissão request existente", () => {
    expect(render({}, ["reservations.read"])).not.toContain("Nova reserva");
    expect(render({}, ["reservations.request"])).toContain(
      'href="/admin/reservas/nova"',
    );
  });
  it("mantém valores exatos, estornos e cauções separados na nova hierarquia", () => {
    const html = render({
      finance: {
        contracted: "900.00",
        received: "0.30",
        refunded: "0.10",
        receivable_now: "899.70",
        deposit_received: "500.00",
        deposit_refunded: "100.00",
        deposit_held_now: "400.00",
        expenses: "5.00",
        expense_reversals: "6.01",
      },
    });
    expect(html).toContain("R$ 0,20");
    expect(html).toContain("R$ -1,01");
    expect(html).toContain("R$ 899,70");
    expect(html).toContain("Cauções disponíveis atualmente");
    expect(html).toContain("R$ 400,00");
    expect(html).toContain("<details");
  });
  it("com dados restritos não apresenta financeiro nem ações operacionais", () => {
    const html = render({});
    expect(html).toContain("Seu acesso está ativo.");
    expect(html).not.toContain('id="finance-title"');
    expect(html).not.toContain('id="operation-title"');
    expect(html).not.toContain("R$");
  });
  it("explica frota sem histórico e devoluções vazias sem apresentar ocupação fictícia", () => {
    const html = render(
      {
        operations: {
          vehicles: 0,
          active_vehicles: 0,
          maintenance: 0,
          occupied: 0,
          available: 0,
          pending_reservations: 0,
          confirmed_reservations: 0,
          active_rentals: 0,
          overdue_rentals: 0,
          occupancy_percent: null,
          coverage_limited: true,
          next_returns: [],
        },
      },
      ["rentals.read"],
    );
    expect(html).toContain("Sem horas observadas");
    expect(html).toContain("Nenhuma devolução aberta neste período.");
    expect(html).toContain("Cobertura histórica limitada");
    expect(html).not.toContain("0% de ocupação");
  });
});
