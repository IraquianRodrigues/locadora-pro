import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { rentalMoney } from "@/lib/rentals/presentation";
import { RentalList } from "@/components/rentals/rental-list";
import { RentalDetail } from "@/components/rentals/rental-detail";
import {
  rentalFixture,
  rentalFixtureId,
  rentalFixtureList,
} from "../../scripts/preview/rentals";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh() {}, push() {} }),
}));
vi.mock("@/lib/rentals/actions", () => ({}));
vi.mock("@/lib/reservations/actions", () => ({}));
const render = (id: string, permissions: string[]) =>
  renderToStaticMarkup(
    createElement(RentalDetail, {
      detail: rentalFixture(id),
      permissions,
      plans: [],
    }),
  );
describe("apresentação de locações Apex", () => {
  it("completa a escala monetária sem arredondar valores exatos", () => {
    expect(rentalMoney("0")).toBe("R$ 0,00");
    expect(rentalMoney("0.5")).toBe("R$ 0,50");
    expect(rentalMoney("1234567890.99")).toBe("R$ 1.234.567.890,99");
    expect(() => rentalMoney("1.001")).toThrow();
  });
  it("distingue o atraso e mantém criação e configuração condicionadas às permissões", () => {
    const html = renderToStaticMarkup(
      createElement(RentalList, {
        ...rentalFixtureList,
        status: "",
        permissions: [],
      }),
    );
    expect(html).toContain("Atrasada");
    expect(html).toContain("Verificar devolução e próximas reservas");
    expect(html).not.toContain("Nova locação direta");
    expect(html).not.toContain("Regras e modelos");
  });
  it("não oferece comandos ou arquivos de vistoria e contrato ao perfil sem essas permissões", () => {
    const html = render(rentalFixtureId, ["rentals.read"]);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Abrir contrato ·");
    expect(html).not.toContain("Abrir foto");
    expect(html).toContain("Seu perfil não permite consultar as vistorias");
    expect(html).toContain("Retirada não confirmada");
  });
  it("preserva as exigências na preparação sem indicar liberação ou pagamento confirmado", () => {
    const html = render(rentalFixtureId, ["rentals.read", "rentals.checkout"]);
    expect(html).toContain("Confirmar retirada");
    expect(html).toContain("Exige condutores válidos");
    expect(html).toContain("não uma confirmação de pagamento");
    expect(html).not.toContain("Vincular condutores");
    expect(html).not.toContain("Apurar e confirmar devolução");
  });
  it("mantém locação encerrada e vistoria concluída sem comandos mesmo com permissão de escrita", () => {
    const html = render(rentalFixtureList.data[3].id, [
      "rentals.create",
      "rentals.checkout",
      "rentals.checkin",
      "inspections.read",
      "inspections.write",
      "contracts.read",
    ]);
    expect(html).toContain("Concluída e imutável");
    expect(html).toContain("Devolução confirmada");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Reagendar contrato com falha");
  });
});
