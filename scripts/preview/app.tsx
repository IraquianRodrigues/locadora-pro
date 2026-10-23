import { AdminFrame } from "../../src/components/layout/admin-frame";
import { NavigationLinks } from "../../src/components/layout/admin-navigation";
import {
  DashboardView,
  type DashboardData,
} from "../../src/components/business/dashboard-view";
import { buildNavigation } from "../../src/lib/navigation";
import { registry } from "../../src/lib/registry/config";
import { BusinessPreview } from "./business";
import { AdministrationPreview } from "./administration";
import { CommercialPreview } from "./commercial";
import { PublicSitePreview } from "./public-site";
import { RentalList } from "../../src/components/rentals/rental-list";
import { RentalDetail } from "../../src/components/rentals/rental-detail";
import { RentalSettingsForm } from "../../src/components/rentals/settings-form";
import { JobsButton } from "../../src/components/rentals/operation-form";
import { rentalFixture, rentalFixtureList, rentalPolicy } from "./rentals";
const permissions = [
  ...Object.values(registry).map((r) => r.read),
  "reservations.read",
  "reservations.request",
  "rentals.read",
  "inspections.read",
  "contracts.read",
  "finance.read",
  "maintenance.read",
  "reports.operations",
  "reports.finance",
  "users.manage",
  "settings.manage",
];
const data: DashboardData = {
  operations: {
    vehicles: 24,
    active_vehicles: 20,
    maintenance: 4,
    occupied: 14,
    available: 6,
    pending_reservations: 3,
    confirmed_reservations: 8,
    active_rentals: 14,
    overdue_rentals: 1,
    occupancy_percent: "68.50",
    coverage_limited: false,
    next_returns: [
      {
        id: "10000000-0000-4000-8000-000000000001",
        end_at: "2026-10-20T17:00:00-03:00",
      },
      {
        id: "10000000-0000-4000-8000-000000000002",
        end_at: "2026-10-20T19:00:00-03:00",
      },
    ],
  },
  finance: {
    contracted: "28750.00",
    received: "19240.00",
    refunded: "600.00",
    receivable_now: "9510.00",
    deposit_received: "6000.00",
    deposit_refunded: "1800.00",
    deposit_held_now: "4200.00",
    expenses: "3260.00",
    expense_reversals: "240.00",
  },
};

import { RegistryList } from "../../src/components/registry/record-list";
import { RegistryForm } from "../../src/components/registry/registry-form";
import { RecordHeader } from "../../src/components/registry/record-header";
import { FilesPanel } from "../../src/components/registry/files-panel";
import { ReservationList } from "../../src/components/reservations/reservation-list";
import { ReservationDetail } from "../../src/components/reservations/reservation-detail";
import { BookingForm } from "../../src/components/reservations/booking-form";
import {
  DecisionForm,
  ExpiryButton,
} from "../../src/components/reservations/decision-form";
import {
  BackLink,
  WorkspaceHeading,
} from "../../src/components/business/workspace";
import { formDefaults } from "../../src/lib/registry/config";
import {
  fixtureRows,
  fixtureOptions,
  fixtureReservations,
  fixtureReservation,
  fixtureQuote,
} from "./fixtures";
export function PreviewApp({ location }: { location: string }) {
  const url = new URL(location, "http://127.0.0.1:3230"),
    parts = url.pathname.split("/").filter(Boolean),
    resource = parts[1],
    record = parts[2],
    empty = url.searchParams.has("empty"),
    readonly = url.searchParams.has("readonly");
  if (url.pathname === "/publico")
    return (
      <PublicSitePreview
        empty={empty}
        preparation={url.searchParams.has("preparacao")}
      />
    );
  const access = readonly
    ? permissions.filter((p) => p !== "settings.manage" && p !== "users.manage")
    : [
        ...permissions,
        ...Object.values(registry).map((r) => r.write),
        "reservations.review",
        "reservations.approve",
        "reservations.cancel_pending",
        "reservations.cancel_confirmed",
        "rentals.create",
        "rentals.checkout",
        "rentals.checkin",
        "rentals.extend",
        "inspections.write",
        "contracts.generate",
        "charges.create",
        "payments.confirm",
        "deposits.manage",
        "expenses.write",
        "refunds.create",
        "discounts.authorize",
        "maintenance.write",
      ];
  let content: React.ReactNode,
    pathname = url.pathname === "/" ? "/admin/dashboard" : url.pathname;
  if (
    resource === "frota" ||
    resource === "clientes" ||
    resource === "condutores"
  ) {
    const rows: Record<string, unknown>[] = fixtureRows[resource],
      filters = {
        q: url.searchParams.get("q") ?? "",
        archived: url.searchParams.get("archived") ?? "false",
        category: url.searchParams.get("category") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
      };
    if (record) {
      const row =
        record === "novo"
          ? undefined
          : (rows.find((r) => r.id === record) ?? rows[0]);
      content = (
        <div className="record-editor">
          <RecordHeader
            resource={resource}
            name={row ? String(row.name ?? row.plate) : undefined}
            id={row ? String(row.id) : undefined}
            archived={row && url.searchParams.has("archived")}
            licenseExpired={
              resource === "condutores" &&
              !!row &&
              String(row.license_expires_on) < "2026-10-20"
            }
          />
          <RegistryForm
            resource={resource}
            defaults={formDefaults(resource, row)}
            options={fixtureOptions}
            disabled={readonly || url.searchParams.has("archived")}
            id={row ? String(row.id) : undefined}
            revision={row ? String(row.updated_at) : undefined}
          />
          {row && (
            <FilesPanel
              ownerId={String(row.id)}
              kinds={
                resource === "frota"
                  ? ["VEHICLE_IMAGE", "VEHICLE_DOCUMENT"]
                  : resource === "clientes"
                    ? ["CUSTOMER_DOCUMENT"]
                    : ["DRIVER_DOCUMENT"]
              }
              writable={
                readonly
                  ? []
                  : resource === "frota"
                    ? ["VEHICLE_IMAGE", "VEHICLE_DOCUMENT"]
                    : resource === "clientes"
                      ? ["CUSTOMER_DOCUMENT"]
                      : ["DRIVER_DOCUMENT"]
              }
              archived={url.searchParams.has("archived")}
              files={[]}
            />
          )}
        </div>
      );
    } else {
      const selected = empty
        ? []
        : rows
            .filter(
              (r) =>
                String(r.name ?? r.plate)
                  .toLocaleLowerCase("pt-BR")
                  .includes(filters.q.toLocaleLowerCase("pt-BR")) &&
                (!filters.status || r.operational_status === filters.status) &&
                (!filters.category || r.category_id === filters.category),
            )
            .map((r) => ({
              ...r,
              archived_at: filters.archived === "true" ? "2026-10-20" : null,
            }));
      content = (
        <RegistryList
          resource={resource}
          data={selected}
          meta={{ page: 1, pageSize: 20, total: selected.length }}
          filters={filters}
          categories={fixtureOptions.categorias}
          writable={!readonly}
        />
      );
    }
  } else if (resource === "reservas") {
    if (record === "nova")
      content = (
        <div className="record-editor">
          <BackLink href="/admin/reservas">Voltar para reservas</BackLink>
          <WorkspaceHeading
            title="Nova cotação e reserva"
            description="Escolha uma categoria ou um veículo. Preços e regras comerciais precisam estar configurados. O pedido passa por análise antes da confirmação."
          />
          <BookingForm options={fixtureOptions} canDiscount={!readonly} />
        </div>
      );
    else if (record) {
      const reservation =
        fixtureReservations.find((r) => r.id === record) ?? fixtureReservation;
      content = (
        <ReservationDetail
          reservation={reservation}
          quote={fixtureQuote}
          permissions={access}
          decision={
            <DecisionForm
              id={reservation.id}
              version={reservation.version}
              status={reservation.status}
              permissions={access}
              expired={false}
            />
          }
        />
      );
    } else {
      const status = url.searchParams.get("status") ?? "",
        selected = empty
          ? []
          : fixtureReservations.filter((r) => !status || r.status === status);
      content = (
        <ReservationList
          data={selected}
          meta={{ page: 1, pageSize: 20, total: selected.length }}
          status={status}
          canRequest={!readonly}
          expiry={!readonly ? <ExpiryButton /> : undefined}
        />
      );
    }
  } else if (resource === "locacoes") {
    if (record === "nova")
      content = (
        <div className="record-editor">
          <BackLink href="/admin/locacoes">Voltar para locações</BackLink>
          <WorkspaceHeading
            title="Nova locação direta"
            description="Selecione um cliente e um veículo específico. A cotação será congelada e a disponibilidade validada ao criar a locação."
          />
          <BookingForm
            options={fixtureOptions}
            canDiscount={!readonly}
            mode="rental"
          />
        </div>
      );
    else if (record === "configuracao")
      content = (
        <div className="record-editor rental-settings">
          <BackLink href="/admin/locacoes">Voltar para locações</BackLink>
          <WorkspaceHeading
            title="Regras e modelos de locação"
            description="Crie os modelos versionados e aprove juridicamente o contrato antes de configurar a operação."
          />
          {readonly ? (
            <p>Consulta sem permissão para alterar configurações.</p>
          ) : (
            <RentalSettingsForm
              policy={rentalPolicy}
              updatedAt={null}
              contracts={[
                {
                  id: rentalPolicy.contract_template_id,
                  template_key: "Contrato de demonstração",
                  version: 1,
                  review_status: "APPROVED",
                },
              ]}
              inspections={[
                {
                  id: rentalPolicy.inspection_template_id,
                  name: "Checklist de demonstração",
                  version: 1,
                },
              ]}
              company={null}
            />
          )}
        </div>
      );
    else if (record)
      content = (
        <RentalDetail
          detail={rentalFixture(record, empty)}
          permissions={access}
          plans={readonly ? [] : fixtureOptions.planos}
        />
      );
    else {
      const status = url.searchParams.get("status") ?? "",
        rows = empty
          ? []
          : rentalFixtureList.data.filter(
              (r) => !status || r.status === status,
            );
      content = (
        <RentalList
          data={rows}
          page={1}
          total={rows.length}
          status={status}
          permissions={access}
          jobs={!readonly ? <JobsButton /> : undefined}
        />
      );
    }
  } else if (
    ["categorias", "unidades", "planos", "precos", "adicionais"].includes(
      resource,
    )
  ) {
    content = <CommercialPreview url={url} empty={empty} readonly={readonly} />;
  } else if (["notificacoes", "usuarios", "site"].includes(resource)) {
    content = (
      <AdministrationPreview url={url} empty={empty} permissions={access} />
    );
  } else if (["financeiro", "manutencao", "relatorios"].includes(resource)) {
    content = (
      <BusinessPreview
        url={url}
        permissions={
          url.searchParams.has("operations")
            ? access.filter((p) => p !== "reports.finance")
            : access
        }
        empty={empty}
        readonly={readonly}
      />
    );
  } else {
    pathname = "/admin/dashboard";
    const display = empty
      ? {
          operations: {
            ...data.operations!,
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
            next_returns: [],
          },
        }
      : data;
    content = (
      <DashboardView
        data={display}
        from="2026-10-01"
        to="2026-10-20"
        permissions={access}
      />
    );
  }
  const query = new URLSearchParams(url.searchParams);
  query.delete("empty");
  const filled = query.toString();
  query.set("empty", "1");
  return (
    <>
      <aside className="preview-notice" aria-label="Ambiente de demonstração">
        Prévia de design · Dados ilustrativos · Sem conexão ao banco
        <a href={`${url.pathname}?${empty ? filled : query}`}>
          {empty ? "Ver exemplo preenchido" : "Ver estado vazio"}
        </a>
      </aside>
      <AdminFrame
        displayName="Equipe de demonstração"
        roleLabel="Perfil ilustrativo de administração"
        navigation={
          <NavigationLinks
            groups={buildNavigation(access)}
            pathname={pathname}
          />
        }
        logout={<p className="mt-4 text-xs">Prévia visual sem sessão</p>}
      >
        {content}
      </AdminFrame>
    </>
  );
}
