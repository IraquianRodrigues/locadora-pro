import type { RentalDetailData } from "../../src/components/rentals/rental-detail";
import type { RentalListData } from "../../src/components/rentals/rental-list";
import { fixtureId } from "./fixtures";
export const rentalFixtureId = "50000001-0000-4000-8000-000000000001";
const id = (n: number) => `5000000${n}-0000-4000-8000-00000000000${n}`;
export const rentalPolicy = {
  version: 1 as const,
  checkout_payment: "FULL" as const,
  checkin_balance: "SETTLED" as const,
  require_deposit: true,
  require_documents: true,
  license_categories: ["B" as const],
  inspection_template_id: fixtureId,
  contract_template_id: fixtureId,
  included_km_per_day: 100,
  late_tolerance_minutes: 30,
  extra_km_amount: "1.00",
  fuel_percent_amount: "2.00",
  late_hour_amount: "20.00",
};
export const rentalFixtureList: RentalListData = {
  page: 1,
  total: 4,
  data: ["PREPARING", "ACTIVE", "OVERDUE", "COMPLETED"].map(
    (status, index) => ({
      id: id(index + 1),
      status,
      version: 3,
      vehicle_id: fixtureId,
      overdue: status === "OVERDUE",
      start_at:
        status === "OVERDUE"
          ? "2026-10-18T12:00:00Z"
          : status === "COMPLETED"
            ? "2026-10-15T12:00:00Z"
            : status === "ACTIVE"
              ? "2026-10-20T12:00:00Z"
              : "2026-10-24T12:00:00Z",
      end_at:
        status === "OVERDUE"
          ? "2026-10-20T12:00:00Z"
          : status === "COMPLETED"
            ? "2026-10-17T12:00:00Z"
            : status === "ACTIVE"
              ? "2026-10-24T12:00:00Z"
              : "2026-10-26T12:00:00Z",
    }),
  ),
};
export function rentalFixture(record: string, empty = false): RentalDetailData {
  const row =
      rentalFixtureList.data.find((r) => r.id === record) ??
      rentalFixtureList.data[0],
    active = ["ACTIVE", "OVERDUE", "COMPLETED"].includes(row.status),
    completed = row.status === "COMPLETED";
  const checklist = [
    { key: "body", label: "Pintura e lataria", photo_required: true },
    {
      key: "interior",
      label: "Interior e acessórios de demonstração",
      photo_required: false,
    },
  ];
  return {
    rental: {
      ...row,
      customer_id: fixtureId,
      branch_id: fixtureId,
      quote_id: fixtureId,
      reservation_id: "30000002-0000-4000-8000-000000000002",
      actual_start_at: active ? row.start_at : null,
      actual_end_at: completed ? row.end_at : null,
      initial_mileage: active ? 12400 : null,
      final_mileage: completed ? 12580 : null,
      initial_fuel: active ? 100 : null,
      final_fuel: completed ? 100 : null,
      commercial_snapshot: {
        operations: rentalPolicy,
        ...(completed ? { closing: { illustrative: true } } : {}),
      },
      rental_drivers: empty
        ? []
        : [
            {
              driver_id: fixtureId,
              driver_snapshot: { name: "Condutor de demonstração" },
            },
          ],
      rental_locations: (["PICKUP", "RETURN"] as const).map(
        (direction, index) => ({
          id: id(index + 5),
          direction,
          mode: "BRANCH",
          address_snapshot: {
            street: "Rua de demonstração",
            number: "100",
            city: "Fortaleza",
            state: "CE",
          },
          fee: "0",
          instructions: "Logística ilustrativa, sem atendimento real.",
          scheduled_at: direction === "PICKUP" ? row.start_at : row.end_at,
          performed_at:
            (index === 0 && active) || completed
              ? index === 0
                ? row.start_at
                : row.end_at
              : null,
          notes: null,
        }),
      ),
      rental_extensions: [],
    },
    overdue: row.overdue,
    conflicts: [],
    nextReservations: row.overdue
      ? [{ reservation_id: "30000001-0000-4000-8000-000000000001", period: "" }]
      : [],
    inspections: empty
      ? []
      : [
          {
            id: id(5),
            kind: "INITIAL",
            mileage: 12400,
            fuel: 100,
            notes: "Vistoria ilustrativa.",
            completed_at: active ? row.start_at : null,
            checklist_snapshot: checklist,
            inspection_items: [
              {
                id: id(6),
                item_key: "body",
                condition: "OK",
                notes: "Sem avaria no exemplo.",
              },
              { id: id(7), item_key: "interior", condition: "OK", notes: null },
            ],
            inspection_photos: [{ id: id(8), item_id: id(6), status: "READY" }],
          },
          ...(active
            ? [
                {
                  id: id(9),
                  kind: "FINAL" as const,
                  mileage: 12580,
                  fuel: 90,
                  notes: "Exemplo de vistoria de devolução.",
                  completed_at: completed ? row.end_at : null,
                  checklist_snapshot: checklist,
                  inspection_items: [
                    {
                      id: fixtureId,
                      item_key: "body",
                      condition: "DAMAGE",
                      notes: "Avaria ilustrativa para avaliação.",
                    },
                    ...(completed
                      ? [
                          {
                            id: id(7),
                            item_key: "interior",
                            condition: "OK",
                            notes: null,
                          },
                        ]
                      : []),
                  ],
                  inspection_photos: completed
                    ? [{ id: id(8), item_id: fixtureId, status: "READY" }]
                    : [],
                },
              ]
            : []),
        ],
    contracts: empty
      ? []
      : [
          {
            id: id(6),
            version: 2,
            generation_status: "GENERATED",
            attempts: 1,
            last_error_code: null,
            sha256: "a".repeat(64),
            created_at: completed ? row.start_at : "2026-10-21T12:00:00Z",
          },
          {
            id: id(7),
            version: 1,
            generation_status: "FAILED",
            attempts: 2,
            last_error_code: "EXAMPLE",
            sha256: null,
            created_at: completed ? row.start_at : "2026-10-21T11:00:00Z",
          },
        ],
    drivers: empty
      ? []
      : [
          {
            id: fixtureId,
            name: "Condutor de demonstração",
            license_category: "B",
            license_expires_on: "2030-10-20",
          },
        ],
    damages: active
      ? [
          {
            id: id(8),
            description:
              "Avaria ilustrativa na lataria, sujeita à avaliação da equipe.",
            status: completed ? "WAIVED" : "OPEN",
            inspection_id: id(9),
          },
        ]
      : [],
    events: [
      {
        id: id(8),
        event_type: active ? "CHECKOUT" : "CREATED",
        created_at: active ? row.start_at : "2026-10-21T10:00:00Z",
        detail: { reason: "Registro ilustrativo, sem efeito comercial." },
      },
    ],
  };
}
