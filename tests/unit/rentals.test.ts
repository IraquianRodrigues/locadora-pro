import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  commandSchema,
  createRentalSchema,
  setupSchema,
  operationalPolicySchema,
  commandPermissions,
} from "@/lib/rentals/schema";
import { renderContractPdf } from "@/lib/rentals/contract-pdf";
import example from "../fixtures/contract.json";
const id = example.rental_id,
  base = { rental_id: id, expected_version: 1 };
describe("locações, vistoria e contratos", () => {
  it("conversão exige versão, criação exige veículo e não aceita preço do cliente", () => {
    expect(createRentalSchema.safeParse({ reservation_id: id }).success).toBe(
      false,
    );
    expect(
      createRentalSchema.safeParse({
        quote_id: id,
        vehicle_id: id,
        total: "0.01",
      }).success,
    ).toBe(false);
    expect(
      createRentalSchema.safeParse({ quote_id: id, vehicle_id: id }).success,
    ).toBe(true);
  });
  it("pré-requisitos não podem ser dispensados pelo payload da retirada", () => {
    expect(
      commandSchema.safeParse({
        ...base,
        action: "CHECKOUT",
        skip_contract: true,
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({ ...base, action: "CHECKOUT" }).success,
    ).toBe(true);
    expect(
      commandSchema.safeParse({ ...base, action: "CHECKIN", final_mileage: 1 })
        .success,
    ).toBe(false);
  });
  it("exige km inteiro, combustível 0..100, notas em avaria e itens únicos", () => {
    expect(
      commandSchema.safeParse({
        ...base,
        action: "INSPECTION",
        kind: "INITIAL",
        mileage: -1,
        fuel: 101,
        notes: "",
      }).success,
    ).toBe(false);
    for (const items of [
      [{ key: "body", condition: "DAMAGE", notes: "" }],
      [
        { key: "body", condition: "OK", notes: "" },
        { key: "body", condition: "OK", notes: "" },
      ],
    ])
      expect(
        commandSchema.safeParse({
          ...base,
          action: "ITEMS",
          inspection_id: id,
          items,
        }).success,
      ).toBe(false);
  });
  it("aprovação jurídica deve ser explícita e política precisa ser completa", () => {
    expect(
      setupSchema.safeParse({
        kind: "CONTRACT_TEMPLATE",
        name: "Teste",
        version: 1,
        body: example.template.body,
        review_status: "APPROVED",
        legal_review_confirmed: false,
      }).success,
    ).toBe(false);
    expect(operationalPolicySchema.safeParse({ version: 1 }).success).toBe(
      false,
    );
    expect(commandPermissions.CHECKOUT).toBe("rentals.checkout");
  });
  it("PDF real contém páginas A4 e metadados e é reproduzível para o mesmo snapshot", async () => {
    const first = await renderContractPdf(example, 1, "2026-10-20T12:00:00Z"),
      second = await renderContractPdf(example, 1, "2026-10-20T12:00:00Z");
    expect(first.subarray(0, 5).toString()).toBe("%PDF-");
    expect(first.equals(second)).toBe(true);
    const doc = await PDFDocument.load(first);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(doc.getTitle()).toContain(example.rental_id);
    for (const page of doc.getPages())
      expect(page.getWidth()).toBeCloseTo(595.28, 1);
  });
  it("template não aprovado e caractere sem glifo falham sem publicar documento incompleto", async () => {
    await expect(
      renderContractPdf(
        {
          ...example,
          template: {
            ...example.template,
            review_status: "LEGAL_REVIEW_REQUIRED",
          },
        },
        1,
        "2026-10-20T12:00:00Z",
      ),
    ).rejects.toThrow();
    await expect(
      renderContractPdf(
        {
          ...example,
          template: {
            ...example.template,
            body: example.template.body + "\u{10FFFF}",
          },
        },
        1,
        "2026-10-20T12:00:00Z",
      ),
    ).rejects.toThrow("UNSUPPORTED_PDF_CHARACTER");
  });
  it("aditivo inclui o período e as linhas da cotação adicional", async () => {
    const raw = {
      ...example,
      commercial: {
        ...example.commercial,
        extensions: [
          {
            quote_id: id,
            total: "100.00",
            previous_end_at: example.end_at,
            end_at: "2026-10-23T12:00:00Z",
            quote: {
              calculation: {
                lines: [
                  {
                    kind: "RENTAL",
                    description: "Prorrogação",
                    quantity: "1.0000",
                    unit_amount: "100.00",
                    total: "100.00",
                  },
                ],
              },
            },
          },
        ],
      },
    };
    const doc = await PDFDocument.load(
      await renderContractPdf(raw, 2, "2026-10-20T12:00:00Z"),
    );
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
  it("nomes extensos e cláusulas longas paginam sem perder a estrutura", async () => {
    const raw = {
      ...example,
      customer: { ...example.customer, name: "A".repeat(300) },
      template: {
        ...example.template,
        body: "Condições de teste. ".repeat(1000),
      },
    };
    const doc = await PDFDocument.load(
      await renderContractPdf(raw, 2, "2026-10-20T12:00:00Z"),
    );
    expect(doc.getPageCount()).toBeGreaterThan(5);
  });
});
