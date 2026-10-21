import { RegistryList } from "../../src/components/registry/record-list";
import { RecordHeader } from "../../src/components/registry/record-header";
import { RegistryForm } from "../../src/components/registry/registry-form";
import { ArchiveButton } from "../../src/components/registry/archive-button";
import { formDefaults } from "../../src/lib/registry/config";
import type { Resource } from "../../src/lib/registry/schema";
import { fixtureId, fixtureOptions } from "./fixtures";
const secondId = "10000002-0000-4000-8000-000000000002";
const revision = "2026-10-21T12:00:00Z";
export const commercialFixtures: Record<string, Record<string, unknown>[]> = {
  categorias: [
    {
      id: fixtureId,
      name: "Categoria de demonstração",
      capacity: 5,
      features: ["Ar-condicionado", "Direção assistida"],
      description: "Características ilustrativas para revisão do cadastro.",
      active: true,
      updated_at: revision,
    },
    {
      id: secondId,
      name: "Categoria de demonstração · sete lugares",
      capacity: 7,
      features: [],
      description: "Exemplo de categoria desativada.",
      active: false,
      updated_at: revision,
    },
  ],
  unidades: [
    {
      id: fixtureId,
      name: "Unidade de demonstração",
      active: true,
      address: {
        postal_code: "60000000",
        street: "Rua de demonstração",
        number: "100",
        district: "Bairro de exemplo",
        city: "Fortaleza",
        state: "CE",
        complement: "",
      },
      updated_at: revision,
    },
  ],
  planos: [
    {
      id: fixtureId,
      name: "Plano diário de demonstração",
      period_unit: "DAY",
      month_mode: null,
      commercial_month_days: null,
      active: true,
      public_enabled: false,
      policy: {
        engine: "v1",
        timezone: "America/Fortaleza",
        duration_basis: "ELAPSED",
        strategy: "DAY_HOUR",
        minimum_periods: 1,
        tolerance_minutes: 30,
        hour_increment_minutes: 60,
        rounding: "HALF_UP",
        week_amount: null,
        day_amount: "180.00",
        hour_amount: "30.00",
        deposit_amount: "1000.00",
        delivery_enabled: false,
        delivery_amount: "0.00",
        collection_enabled: false,
        collection_amount: "0.00",
        discount_scope: "RENTAL",
        admin_discount_bps: 1000,
        manager_discount_bps: 500,
        turnaround_minutes: 60,
        quote_validity_minutes: 30,
        request_validity_minutes: 1440,
        lookup_validity_days: 30,
      },
      updated_at: revision,
    },
  ],
  precos: [
    {
      id: fixtureId,
      name: "Tarifa de demonstração · categoria",
      rate_plan_id: fixtureId,
      category_id: fixtureId,
      vehicle_id: null,
      amount: "180.00",
      valid_from: "2026-10-01T00:00:00-03:00",
      valid_to: "2026-11-01T00:00:00-03:00",
      updated_at: revision,
    },
    {
      id: secondId,
      name: "Tarifa de demonstração · veículo",
      rate_plan_id: fixtureId,
      category_id: null,
      vehicle_id: fixtureId,
      amount: "210.00",
      valid_from: "2026-11-01T00:00:00-03:00",
      valid_to: "2026-12-01T00:00:00-03:00",
      updated_at: revision,
    },
  ],
  adicionais: [
    {
      id: fixtureId,
      name: "Serviço de demonstração",
      unit: "ONCE",
      amount: "50.00",
      active: true,
      public_enabled: false,
      updated_at: revision,
    },
    {
      id: secondId,
      name: "Adicional diário de demonstração",
      unit: "DAY",
      amount: "20.00",
      active: false,
      public_enabled: false,
      updated_at: revision,
    },
  ],
};
export function CommercialPreview({
  url,
  empty,
  readonly,
}: {
  url: URL;
  empty: boolean;
  readonly: boolean;
}) {
  const [, , raw, record] = url.pathname.split("/"),
    resource = raw as Resource,
    rows = commercialFixtures[resource];
  const archived =
    url.searchParams.get("archived") === "true" ||
    url.searchParams.get("archived") === "1";
  if (record) {
    const row =
      record === "novo"
        ? undefined
        : (rows.find((r) => r.id === record) ?? rows[0]);
    return (
      <div className="record-editor">
        <RecordHeader
          resource={resource}
          name={row ? String(row.name) : undefined}
          id={row ? String(row.id) : undefined}
          archived={!!row && archived}
        />
        <RegistryForm
          resource={resource}
          defaults={formDefaults(resource, row)}
          options={url.searchParams.has("nolookups") ? {} : fixtureOptions}
          disabled={readonly || archived}
          id={row ? String(row.id) : undefined}
          revision={row ? String(row.updated_at) : undefined}
          timezone="America/Fortaleza"
        />
        {row && !readonly && (
          <div className="archive-section">
            <ArchiveButton
              resource={resource}
              id={String(row.id)}
              revision={String(row.updated_at)}
              archived={archived}
            />
          </div>
        )}
      </div>
    );
  }
  const filters = {
    q: url.searchParams.get("q") ?? "",
    archived: archived ? "true" : "false",
  };
  const selected = empty
    ? []
    : rows
        .filter((r) =>
          String(r.name)
            .toLocaleLowerCase("pt-BR")
            .includes(filters.q.toLocaleLowerCase("pt-BR")),
        )
        .map((r) => ({ ...r, archived_at: archived ? revision : null }));
  return (
    <RegistryList
      resource={resource}
      data={selected}
      meta={{ page: 1, pageSize: 20, total: selected.length }}
      filters={filters}
      categories={[]}
      writable={!readonly}
      timezone="America/Fortaleza"
    />
  );
}
