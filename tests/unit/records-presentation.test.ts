import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { registry, formDefaults } from "@/lib/registry/config";
import { resources } from "@/lib/registry/schema";
import { registryFieldGroups } from "@/lib/registry/field-groups";
import { RegistryList } from "@/components/registry/record-list";
import { ReservationDetail } from "@/components/reservations/reservation-detail";
import {
  fixtureReservation,
  fixtureQuote,
} from "../../scripts/preview/fixtures";

describe("cadastros e reservas na apresentação Apex", () => {
  it("mantém cada campo de cada cadastro exatamente uma vez ao agrupar formulários", () => {
    for (const resource of resources) {
      const fields = registryFieldGroups(resource).flatMap((group) =>
        group.fields.map((field) => field.name),
      );
      expect(fields.sort()).toEqual(
        registry[resource].fields.map((field) => field.name).sort(),
      );
      expect(new Set(fields).size).toBe(fields.length);
      expect(Object.keys(formDefaults(resource)).sort()).toEqual(fields);
    }
  });
  it("mantém documentos mascarados e não oferece criação a quem está em consulta", () => {
    const html = renderToStaticMarkup(
      createElement(RegistryList, {
        resource: "clientes",
        data: [
          {
            id: "fixture",
            name: "Cliente de teste",
            person_type: "PF",
            tax_document: "11144477735",
          },
        ],
        meta: { page: 1, total: 1, pageSize: 20 },
        filters: { archived: "false" },
        categories: [],
        writable: false,
      }),
    );
    expect(html).not.toContain("11144477735");
    expect(html).not.toContain("Cadastrar cliente");
    expect(html).toContain("Consulta somente");
    expect(html).toContain("Cliente de teste");
  });
  it("não confunde estado operacional ativo com disponibilidade para locação", () => {
    const html = renderToStaticMarkup(
      createElement(RegistryList, {
        resource: "frota",
        data: [
          {
            id: "fixture",
            plate: "AAA1A01",
            make: "Veículo",
            model: "Teste",
            model_year: 2026,
            operational_status: "ACTIVE",
          },
        ],
        meta: { page: 1, total: 1, pageSize: 20 },
        filters: { archived: "false" },
        categories: [],
        writable: true,
      }),
    );
    expect(html).toContain("Situação operacional");
    expect(html).not.toContain("Disponível para locação");
    expect(html).toContain("Ativo");
  });
  it("separa cotação, caução e logística, preservando a ordem do histórico sem mutar dados", () => {
    const reversed = {
      ...fixtureReservation,
      reservation_status_history: [
        ...fixtureReservation.reservation_status_history,
      ].reverse(),
    };
    const first = reversed.reservation_status_history[0].id;
    const html = renderToStaticMarkup(
      createElement(ReservationDetail, {
        reservation: reversed,
        quote: fixtureQuote,
        permissions: [],
      }),
    );
    expect(html).toContain("R$ 480,00");
    expect(html).toContain("Caução separada");
    expect(html).toContain("Retirada e devolução");
    expect(html).not.toContain("Abrir cliente");
    expect(reversed.reservation_status_history[0].id).toBe(first);
  });
});
