import { FinanceView } from "../../src/components/finance/finance-view";
import { FinanceConfigurationForm } from "../../src/components/finance/configuration-form";
import {
  MaintenanceList,
  MaintenanceDetailView,
} from "../../src/components/maintenance/maintenance-view";
import { NewMaintenanceForm } from "../../src/components/maintenance/maintenance-forms";
import { ReportsView } from "../../src/components/reports/reports-view";
import {
  reportLabels,
  reportFilterSchema,
  financeReports,
} from "../../src/lib/reports/schema";
import { registerKinds } from "../../src/lib/finance/schema";
import {
  BackLink,
  WorkspaceHeading,
} from "../../src/components/business/workspace";
import { Button } from "../../src/components/ui/button";
import {
  financeFixtureOptions,
  financeFixtureRows,
  maintenanceFixture,
  maintenanceFixtureList,
  maintenanceFixtureAlerts,
  reportFixtureRows,
  businessTimezone,
} from "./business-fixtures";
export function BusinessPreview({
  url,
  permissions,
  empty,
  readonly,
}: {
  url: URL;
  permissions: string[];
  empty: boolean;
  readonly: boolean;
}) {
  const [, resource, record] = url.pathname.split("/").filter(Boolean);
  if (resource === "financeiro") {
    if (record === "configuracao")
      return (
        <div className="record-editor">
          <BackLink href="/admin/financeiro">Voltar para financeiro</BackLink>
          <WorkspaceHeading
            title="Meios e limites financeiros"
            description="Configuração restrita ao administrador. Desativar um meio preserva seu histórico."
          />
          {readonly ? (
            <p>Consulta sem permissão para alterar configurações.</p>
          ) : (
            <FinanceConfigurationForm
              methods={[
                {
                  ...financeFixtureOptions.methods[0],
                  active: true,
                  updated_at: "2026-10-21T12:00:00Z",
                },
              ]}
              policy={null}
            />
          )}
        </div>
      );
    const rawKind = url.searchParams.get("kind") ?? "CHARGES",
      kind = registerKinds.find((k) => k === rawKind) ?? "CHARGES",
      customer = url.searchParams.get("customer"),
      rental = url.searchParams.get("rental"),
      rows = empty ? [] : financeFixtureRows[kind];
    return (
      <FinanceView
        result={{ rows, page: 1, page_size: 20, total: rows.length }}
        options={financeFixtureOptions}
        filters={{ kind, page: 1, customer, rental }}
        query={url.searchParams.get("q") ?? ""}
        permissions={permissions}
        timezone={businessTimezone}
      />
    );
  }
  if (resource === "manutencao") {
    if (record === "nova")
      return (
        <div className="record-editor">
          <BackLink href="/admin/manutencao">Voltar para manutenção</BackLink>
          <WorkspaceHeading
            title="Agendar manutenção"
            description="Defina o veículo, o serviço e o período. Os compromissos existentes serão validados ao salvar."
          />
          <form
            className="records-filter maintenance-vehicle-filter"
            method="get"
          >
            <label className="records-search">
              Localizar veículo pela placa
              <input
                name="q"
                defaultValue={url.searchParams.get("q") ?? ""}
                maxLength={20}
                pattern="[a-zA-Z0-9]*"
              />
            </label>
            <p className="field-help">
              Até 100 veículos por busca, incluindo os inativos e em manutenção.
            </p>
            <Button variant="outline">Buscar veículos</Button>
          </form>
          <NewMaintenanceForm
            vehicles={financeFixtureOptions.vehicles}
            timezone={businessTimezone}
          />
        </div>
      );
    if (record)
      return (
        <MaintenanceDetailView
          data={maintenanceFixture(record)}
          permissions={permissions}
          methods={financeFixtureOptions.methods}
          timezone={businessTimezone}
        />
      );
    const status = url.searchParams.get("status") ?? "",
      rows = empty
        ? []
        : maintenanceFixtureList.rows.filter(
            (r) => !status || r.status === status,
          );
    return (
      <MaintenanceList
        list={{ rows, page: 1, total: rows.length }}
        alerts={empty ? { due: [], unfinished: [] } : maintenanceFixtureAlerts}
        status={status}
        permissions={permissions}
        timezone={businessTimezone}
      />
    );
  }
  const allowed = Object.keys(reportLabels).filter((k) =>
      permissions.includes(
        financeReports.has(k) ? "reports.finance" : "reports.operations",
      ),
    ),
    parsed = reportFilterSchema.safeParse({
      kind: url.searchParams.get("kind") ?? allowed[0],
      from: url.searchParams.get("from") ?? "2026-10-01",
      to: url.searchParams.get("to") ?? "2026-10-31",
      page: 1,
      page_size: 50,
    });
  if (!parsed.success || !allowed.includes(parsed.data.kind))
    return (
      <>
        <WorkspaceHeading title="Relatórios" />
        <p role="alert">
          Filtros inválidos ou relatório indisponível para este perfil. Escolha
          um período de até 366 dias.
        </p>
        <a className="text-link" href="/admin/relatorios">
          Limpar filtros
        </a>
      </>
    );
  const rows = empty ? [] : reportFixtureRows[parsed.data.kind];
  return (
    <ReportsView
      filters={parsed.data}
      result={{
        rows,
        page: 1,
        page_size: 50,
        total: rows.length,
        kind: parsed.data.kind,
      }}
      allowed={allowed}
      timezone={businessTimezone}
      preview
    />
  );
}
