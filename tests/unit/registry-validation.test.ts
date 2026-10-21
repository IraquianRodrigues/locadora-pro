import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  normalizeDocument,
  normalizePhone,
  validCpf,
  validCnpj,
  validPhone,
  validCivilDate,
} from "@/lib/registry/brazil";
import {
  addressSchema,
  categorySchema,
  customerSchema,
  driverSchema,
  listSchema,
  vehicleSchema,
} from "@/lib/registry/schema";

const address = {
  postal_code: "60000-000",
  street: "Rua de teste",
  number: "S/N",
  district: "Centro",
  city: "Fortaleza",
  state: "CE",
  complement: "",
};
const customer = {
  ...address,
  person_type: "PF",
  name: "Pessoa de teste",
  tax_document: "529.982.247-25",
  email: "TESTE@example.invalid",
  phone: "+55 (85) 98888-7777",
  birth_date: "2000-01-01",
  notes: "",
};
const vehicle = {
  category_id: randomUUID(),
  branch_id: randomUUID(),
  plate: "abc-1234",
  chassis: "9BWZZZ377VT004251",
  renavam: "12345678901",
  make: "Marca",
  model: "Modelo",
  version: "",
  manufacture_year: 2025,
  model_year: 2026,
  color: "Branco",
  fuel: "FLEX",
  transmission: "MANUAL",
  passengers: 5,
  doors: 4,
  mileage: 0,
  description: "",
  features: "Ar, ABS, Ar",
  operational_status: "ACTIVE",
  acquired_on: "",
  internal_notes: "",
};
describe("validações brasileiras e entrada dos cadastros", () => {
  it("CPF recusa repetição, formato inválido e DV adulterado", () => {
    expect(validCpf(normalizeDocument("529.982.247-25"))).toBe(true);
    for (const cpf of [
      "11111111111",
      "52998224724",
      "123",
      "letters",
      "529.982.247-25",
    ])
      expect(validCpf(cpf)).toBe(false);
  });
  it("CNPJ numérico e alfanumérico usam ASCII menos 48 e dígitos verificadores", () => {
    expect(validCnpj(normalizeDocument("11.222.333/0001-81"))).toBe(true);
    expect(validCnpj(normalizeDocument("12.abc.345/01de-35"))).toBe(true);
    for (const cnpj of [
      "12ABC34501DE00",
      "00000000000000",
      "12ABC34501DE3A",
      "111",
    ])
      expect(validCnpj(cnpj)).toBe(false);
  });
  it("normaliza telefone nacional e internacional e recusa DDD/número inválido", () => {
    expect(normalizePhone("+55 (85) 98888-7777")).toBe("85988887777");
    expect(normalizePhone("(55) 3333-4444")).toBe("5533334444");
    for (const phone of ["85988887777", "8533334444", "11999998888"])
      expect(validPhone(phone)).toBe(true);
    for (const phone of [
      "00988887777",
      "8588887777",
      "8563334444",
      "85letters99",
    ])
      expect(validPhone(phone)).toBe(false);
  });
  it("endereço exige CEP, UF e campos brasileiros; datas civis rejeitam rollover", () => {
    expect(addressSchema.parse(address).postal_code).toBe("60000000");
    expect(addressSchema.safeParse({ ...address, state: "XX" }).success).toBe(
      false,
    );
    expect(
      addressSchema.safeParse({ ...address, postal_code: "60000" }).success,
    ).toBe(false);
    expect(addressSchema.safeParse({ ...address, street: "" }).success).toBe(
      false,
    );
    expect(validCivilDate("2024-02-29")).toBe(true);
    expect(validCivilDate("2025-02-29")).toBe(false);
    expect(validCivilDate("2026-13-01")).toBe(false);
  });
  it("cliente PF normalizado grava endereço composto sem aceitar campos de privilégio", () => {
    expect(customerSchema.parse(customer)).toMatchObject({
      tax_document: "52998224725",
      email: "teste@example.invalid",
      phone: "85988887777",
      address: { postal_code: "60000000", state: "CE" },
    });
    expect(
      customerSchema.safeParse({ ...customer, active: true }).success,
    ).toBe(false);
    expect(
      customerSchema.safeParse({ ...customer, birth_date: "2200-01-01" })
        .success,
    ).toBe(false);
  });
  it("cliente PJ exige CNPJ e não aceita nascimento", () => {
    const pj = {
      ...customer,
      person_type: "PJ",
      tax_document: "12ABC34501DE35",
      birth_date: "",
    };
    expect(customerSchema.parse(pj).birth_date).toBeNull();
    expect(
      customerSchema.safeParse({ ...pj, birth_date: "2000-01-01" }).success,
    ).toBe(false);
    expect(
      customerSchema.safeParse({ ...pj, tax_document: "52998224725" }).success,
    ).toBe(false);
  });
  it("veículo normaliza placa antiga/Mercosul, características e valida chassi/anos", () => {
    expect(vehicleSchema.parse(vehicle)).toMatchObject({
      plate: "ABC1234",
      features: ["Ar", "ABS"],
    });
    expect(
      vehicleSchema.safeParse({ ...vehicle, plate: "abc1d23" }).success,
    ).toBe(true);
    for (const change of [
      { plate: "ABC12345" },
      { chassis: "IBWZZZ377VT004251" },
      { model_year: 2024 },
      { renavam: "abc" },
      { mileage: -1 },
      { passengers: 0 },
      { fuel: "FAKE" },
      { archived_at: "2026-01-01" },
    ])
      expect(vehicleSchema.safeParse({ ...vehicle, ...change }).success).toBe(
        false,
      );
  });
  it("condutor tem identidade própria, vínculo e CNH; vencimento é cadastrado com alerta na UI", () => {
    const input = {
      customer_id: randomUUID(),
      name: "Condutor",
      cpf: "111.444.777-35",
      license_number: "12345678901",
      license_category: "AB",
      license_expires_on: "2020-01-01",
    };
    expect(driverSchema.parse(input).cpf).toBe("11144477735");
    for (const change of [
      { customer_id: "forged" },
      { cpf: "11111111111" },
      { license_category: "Z" },
      { license_number: "11111111111" },
      { license_expires_on: "2025-02-30" },
      { document_path: "forged" },
    ])
      expect(driverSchema.safeParse({ ...input, ...change }).success).toBe(
        false,
      );
  });
  it("categorias limitam características, capacidade e recusam mass assignment", () => {
    const input = {
      name: "Categoria",
      description: "",
      capacity: 5,
      features: "Ar, ABS",
      active: true,
    };
    expect(categorySchema.safeParse(input).success).toBe(true);
    expect(categorySchema.safeParse({ ...input, capacity: 0 }).success).toBe(
      false,
    );
    expect(
      categorySchema.safeParse({ ...input, id: randomUUID() }).success,
    ).toBe(false);
  });
  it("paginação é limitada e filtros vazios do formulário são opcionais", () => {
    expect(listSchema.parse({ category: "", status: "" })).toMatchObject({
      page: 1,
      archived: "false",
    });
    for (const value of [
      { page: 0 },
      { page: 10001 },
      { q: "a".repeat(101) },
      { category: "invalid" },
      { status: "forged" },
    ])
      expect(listSchema.safeParse(value).success).toBe(false);
  });
});
