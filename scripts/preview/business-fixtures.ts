import type {
  FinanceOptions,
  RegisterRow,
} from "../../src/lib/finance/service";
import type {
  MaintenanceDetailData,
  MaintenanceListData,
  MaintenanceAlertsData,
} from "../../src/components/maintenance/maintenance-view";
import type { ReportData } from "../../src/components/reports/reports-view";
import { fixtureId, fixtureOptions } from "./fixtures";
export const businessTimezone = "America/Fortaleza";
export const businessId = (n: number) =>
  `6000000${n}-0000-4000-8000-00000000000${n}`;
export const financeFixtureOptions: FinanceOptions = {
  customers: fixtureOptions.clientes,
  vehicles: fixtureOptions.frota,
  methods: [{ id: fixtureId, name: "Meio de demonstração" }],
  rentals: [
    {
      id: "50000002-0000-4000-8000-000000000002",
      customer_id: fixtureId,
      vehicle_id: fixtureId,
      status: "ACTIVE",
    },
  ],
};
const rental = financeFixtureOptions.rentals[0].id;
export const financeFixtureRows: Record<string, RegisterRow[]> = {
  CHARGES: [
    {
      id: businessId(1),
      customer_id: fixtureId,
      customer_name: "Cliente de demonstração",
      rental_id: rental,
      kind: "RENTAL",
      description: "Locação ilustrativa · período contratado",
      amount: "1300.00",
      balance: "700.00",
      due_at: "2026-10-24T12:00:00Z",
      competence_at: "2026-10-21T12:00:00Z",
    },
  ],
  PAYMENTS: [
    {
      id: businessId(2),
      customer_id: fixtureId,
      customer_name: "Cliente de demonstração",
      amount: "650.00",
      free_amount: "100.00",
      method: "Meio de demonstração",
      confirmed_at: "2026-10-21T12:00:00Z",
      allocations: [
        {
          id: businessId(6),
          charge_id: businessId(1),
          amount: "500.00",
          refundable: "500.00",
        },
      ],
    },
  ],
  DEPOSITS: [
    {
      id: businessId(3),
      rental_id: rental,
      amount: "1000.00",
      balance: "800.00",
      created_at: "2026-10-21T12:00:00Z",
      applications: [
        {
          id: businessId(7),
          charge_id: businessId(8),
          amount: "200.00",
          reversible: "200.00",
        },
      ],
    },
  ],
  REFUNDS: [
    {
      id: businessId(4),
      payment_id: businessId(2),
      amount: "50.00",
      reason: "Reembolso ilustrativo, sem movimentação real.",
      created_at: "2026-10-21T13:00:00Z",
    },
  ],
  EXPENSES: [
    {
      id: businessId(5),
      vehicle_id: fixtureId,
      amount: "250.00",
      reversible: "200.00",
      description: "Despesa ilustrativa de serviço",
      occurred_at: "2026-10-21T12:00:00Z",
      created_at: "2026-10-21T12:00:00Z",
    },
  ],
  ADJUSTMENTS: [
    {
      id: businessId(6),
      charge_id: businessId(1),
      kind: "DISCOUNT",
      amount: "100.00",
      reason: "Ajuste ilustrativo aprovado no exemplo.",
      created_at: "2026-10-21T12:00:00Z",
    },
  ],
};
export const maintenanceFixtureList: MaintenanceListData = {
  page: 1,
  total: 3,
  rows: ["SCHEDULED", "IN_PROGRESS", "COMPLETED"].map((status, index) => ({
    id: businessId(index + 1),
    vehicle_id: fixtureId,
    kind: ["PREVENTIVE", "CORRECTIVE", "OIL"][index],
    status,
    mileage: 12500,
    start_at: index === 0 ? "2026-10-24T12:00:00Z" : "2026-10-18T12:00:00Z",
    end_at: index === 0 ? "2026-10-25T12:00:00Z" : "2026-10-20T12:00:00Z",
    actual_start_at: index > 0 ? "2026-10-18T12:00:00Z" : null,
    actual_end_at: index === 2 ? "2026-10-20T12:00:00Z" : null,
    blocks_availability: true,
    description:
      "Serviço de demonstração. Dados ilustrativos, sem compromisso real de veículo.",
    next_due_on: index === 2 ? "2026-10-21" : null,
    next_due_mileage: index === 2 ? 13000 : null,
    version: 2,
  })),
};
export const maintenanceFixtureAlerts: MaintenanceAlertsData = {
  due: [
    {
      id: businessId(3),
      vehicle_id: fixtureId,
      kind: "OIL",
      current_mileage: 12600,
      next_due_on: "2026-10-21",
      next_due_mileage: 13000,
    },
  ],
  unfinished: [
    {
      id: businessId(2),
      vehicle_id: fixtureId,
      kind: "CORRECTIVE",
      status: "IN_PROGRESS",
      end_at: "2026-10-20T12:00:00Z",
    },
  ],
};
export function maintenanceFixture(id: string): MaintenanceDetailData {
  const record =
    maintenanceFixtureList.rows.find((r) => r.id === id) ??
    maintenanceFixtureList.rows[0];
  return {
    record,
    events: [
      {
        id: businessId(9),
        event_type:
          record.status === "COMPLETED"
            ? "COMPLETE"
            : record.status === "IN_PROGRESS"
              ? "START"
              : "CREATE",
        created_at:
          record.actual_end_at ??
          record.actual_start_at ??
          "2026-10-21T12:00:00Z",
        detail: { reason: "Evento ilustrativo para revisão da interface." },
      },
    ],
  };
}
export const reportFixtureRows: Record<string, ReportData["rows"]> = {
  REVENUE: [
    {
      id: businessId(1),
      customer: "Cliente de demonstração",
      kind: "RENTAL",
      competence: "2026-10-21T12:00:00Z",
      gross: "1300.00",
      contracted: "1200.00",
    },
  ],
  RECEIPTS: [
    {
      id: businessId(2),
      kind: "RECEIPT",
      date: "2026-10-21T12:00:00Z",
      amount: "650.00",
    },
    {
      id: businessId(4),
      kind: "REFUND",
      date: "2026-10-21T13:00:00Z",
      amount: "-50.00",
    },
  ],
  EXPENSES: [
    {
      id: businessId(5),
      vehicle: "AAA1A01 · Veículo de demonstração",
      kind: "EXPENSE",
      amount: "250.00",
      date: "2026-10-21T12:00:00Z",
    },
    {
      id: businessId(6),
      vehicle: "AAA1A01 · Veículo de demonstração",
      kind: "REVERSAL",
      amount: "-50.00",
      date: "2026-10-21T13:00:00Z",
    },
  ],
  PROFITABILITY: [
    {
      vehicle_id: fixtureId,
      vehicle: "AAA1A01 · Veículo de demonstração",
      contracted: "1200.00",
      expenses: "250.00",
      expense_reversals: "50.00",
      net_expenses: "200.00",
      contracted_result: "1000.00",
    },
  ],
  BALANCES: [
    {
      id: businessId(1),
      customer: "Cliente de demonstração",
      rental_id: rental,
      due_at: "2026-10-24T12:00:00Z",
      balance: "700.00",
    },
  ],
  RESERVATIONS: [
    { status: "CONFIRMED", count: "3" },
    { status: "UNDER_REVIEW", count: "1" },
  ],
  OCCUPANCY: [
    {
      fleet_hours: "240",
      rented_hours: "120",
      occupancy_percent: "50.00",
      coverage_limited: "true",
    },
  ],
  RECURRING: [
    {
      customer_id: fixtureId,
      customer:
        "Cliente de demonstração com nome extenso para conferir a leitura do relatório",
      rentals: "2",
    },
  ],
  OVERDUE: [
    {
      id: "50000003-0000-4000-8000-000000000003",
      vehicle: "AAA1A01 · Veículo de demonstração",
      expected_return: "2026-10-20T12:00:00Z",
      status: "OVERDUE",
    },
  ],
  MAINTENANCE: [
    {
      id: businessId(3),
      vehicle: "AAA1A01 · Veículo de demonstração",
      kind: "OIL",
      completed_at: "2026-10-20T12:00:00Z",
      mileage: "12500",
      next_due_on: "2026-10-21",
      next_due_mileage: "13000",
    },
  ],
};
