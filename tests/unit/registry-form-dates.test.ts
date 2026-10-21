import { describe, it, expect } from "vitest";
import { priceFormDefaults, priceFormInput } from "@/lib/registry/form-dates";
import { priceInputSchema } from "@/lib/pricing/policy";
const timezone = "America/Fortaleza";
describe("vigência no formulário de preços", () => {
  it("converte o fuso de apresentação e conserva o instante original e sua precisão quando não editado", () => {
    const original = {
      valid_from: "2026-10-21T12:30:15.123456Z",
      valid_to: "2026-11-21T12:00:00Z",
      amount: "180.00",
    };
    const defaults = priceFormDefaults(original, timezone);
    expect(defaults.valid_from).toBe("2026-10-21T09:30:15");
    expect(priceFormInput(defaults, timezone, original)).toEqual({
      input: original,
      error: null,
    });
  });
  it("converte alterações locais sem deslocar para o fuso da máquina", () => {
    const result = priceFormInput(
      { valid_from: "2026-10-21T09:00", valid_to: "2026-10-22T09:00" },
      timezone,
      {},
    );
    expect(result).toEqual({
      input: {
        valid_from: "2026-10-21T12:00:00Z",
        valid_to: "2026-10-22T12:00:00Z",
      },
      error: null,
    });
  });
  it("associa data ausente, inexistente ou ambígua ao campo correspondente", () => {
    expect(
      priceFormInput(
        { valid_from: "", valid_to: "2026-10-22T09:00" },
        timezone,
        {},
      ).error,
    ).toBe("valid_from");
    expect(
      priceFormInput(
        { valid_from: "2026-03-08T02:30", valid_to: "2026-03-09T12:00" },
        "America/New_York",
        {},
      ).error,
    ).toBe("valid_from");
    expect(
      priceFormInput(
        { valid_from: "2026-10-01T12:00", valid_to: "2026-11-01T01:30" },
        "America/New_York",
        {},
      ).error,
    ).toBe("valid_to");
  });
  it("mantém no schema existente a exclusividade de escopo e o fim posterior", () => {
    const converted = priceFormInput(
      { valid_from: "2026-10-22T09:00", valid_to: "2026-10-21T09:00" },
      timezone,
      {},
    );
    const parsed = priceInputSchema.safeParse({
      ...converted.input,
      name: "Exemplo",
      rate_plan_id: "10000001-0000-4000-8000-000000000001",
      category_id: "10000001-0000-4000-8000-000000000001",
      vehicle_id: "10000001-0000-4000-8000-000000000001",
      amount: "180,00",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(parsed.error.issues.map((i) => i.path[0])).toEqual(
        expect.arrayContaining(["category_id", "valid_to"]),
      );
  });
});
