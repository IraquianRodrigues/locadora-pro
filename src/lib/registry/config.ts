import type { Resource } from "./schema";
import { states } from "./brazil";
export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "date"
    | "datetime-local"
    | "email"
    | "textarea"
    | "checkbox"
    | "select";
  options?: readonly string[];
  lookup?: Resource;
  optional?: boolean;
  help?: string;
};
const address: Field[] = [
  { name: "postal_code", label: "CEP" },
  { name: "street", label: "Logradouro" },
  { name: "number", label: "Número (ou S/N)" },
  { name: "district", label: "Bairro" },
  { name: "city", label: "Cidade" },
  { name: "state", label: "UF", type: "select", options: states },
  { name: "complement", label: "Complemento", optional: true },
];
const features: Field = {
  name: "features",
  label: "Características",
  help: "Separe por vírgulas.",
  optional: true,
};
type Definition = {
  title: string;
  singular: string;
  table: string;
  read: string;
  write: string;
  search: string;
  columns: string;
  fields: Field[];
};
export const registry: Record<Resource, Definition> = {
  planos: {
    title: "Planos tarifários",
    singular: "plano",
    table: "rate_plans",
    read: "pricing.read",
    write: "pricing.write",
    search: "name",
    columns: "id,name,period_unit,active,archived_at,updated_at",
    fields: [
      { name: "name", label: "Nome" },
      {
        name: "period_unit",
        label: "Período principal",
        type: "select",
        options: ["DAY", "WEEK", "MONTH"],
      },
      {
        name: "month_mode",
        label: "Modo mensal",
        type: "select",
        options: ["CALENDAR", "COMMERCIAL"],
        optional: true,
      },
      {
        name: "commercial_month_days",
        label: "Dias do mês comercial",
        type: "number",
        optional: true,
      },
      {
        name: "timezone",
        label: "Fuso IANA",
        help: "Ex.: America/Fortaleza. Defina o fuso comercial da locadora.",
      },
      {
        name: "duration_basis",
        label: "Contagem de dias",
        type: "select",
        options: ["ELAPSED", "LOCAL_DAYS"],
      },
      {
        name: "strategy",
        label: "Excedentes",
        type: "select",
        options: ["CEIL_PERIOD", "DAY_HOUR", "WEEK_DAY_HOUR"],
      },
      {
        name: "minimum_periods",
        label: "Mínimo de períodos principais",
        type: "number",
        help: "É cobrado mesmo quando a duração é menor que um período.",
      },
      {
        name: "tolerance_minutes",
        label: "Tolerância em minutos",
        type: "number",
      },
      {
        name: "hour_increment_minutes",
        label: "Incremento da hora: 15, 30 ou 60 minutos",
        type: "number",
      },
      {
        name: "rounding",
        label: "Arredondamento monetário",
        type: "select",
        options: ["HALF_UP", "CEIL", "TRUNCATE"],
      },
      { name: "week_amount", label: "Semana excedente (R$)", optional: true },
      { name: "day_amount", label: "Diária excedente (R$)", optional: true },
      { name: "hour_amount", label: "Hora excedente (R$)", optional: true },
      { name: "deposit_amount", label: "Caução separada (R$)" },
      { name: "delivery_enabled", label: "Permitir entrega", type: "checkbox" },
      { name: "delivery_amount", label: "Taxa fixa de entrega (R$)" },
      {
        name: "collection_enabled",
        label: "Permitir coleta",
        type: "checkbox",
      },
      { name: "collection_amount", label: "Taxa fixa de coleta (R$)" },
      {
        name: "discount_scope",
        label: "Base do desconto",
        type: "select",
        options: ["RENTAL", "RENTAL_AND_SERVICES"],
      },
      {
        name: "admin_discount_bps",
        label: "Limite ADMIN (pontos base; 100 = 1%)",
        type: "number",
      },
      {
        name: "manager_discount_bps",
        label: "Limite MANAGER (pontos base; 100 = 1%)",
        type: "number",
      },
      {
        name: "turnaround_minutes",
        label: "Intervalo após devolução em minutos",
        type: "number",
      },
      {
        name: "quote_validity_minutes",
        label: "Validade da cotação em minutos",
        type: "number",
      },
      {
        name: "request_validity_minutes",
        label: "Prazo de análise da reserva em minutos",
        type: "number",
      },
      {
        name: "lookup_validity_days",
        label: "Validade do token de consulta em dias",
        type: "number",
      },
      { name: "active", label: "Ativo", type: "checkbox" },
      {
        name: "public_enabled",
        label: "Publicar este plano no site",
        type: "checkbox",
      },
    ],
  },
  precos: {
    title: "Preços e vigências",
    singular: "preço",
    table: "rate_plan_prices",
    read: "pricing.read",
    write: "pricing.write",
    search: "name",
    columns: "id,name,amount,valid_from,valid_to,archived_at,updated_at",
    fields: [
      { name: "name", label: "Nome" },
      {
        name: "rate_plan_id",
        label: "Plano",
        type: "select",
        lookup: "planos",
      },
      {
        name: "category_id",
        label: "Categoria (ou veículo)",
        type: "select",
        lookup: "categorias",
        optional: true,
      },
      {
        name: "vehicle_id",
        label: "Veículo (ou categoria)",
        type: "select",
        lookup: "frota",
        optional: true,
      },
      {
        name: "valid_from",
        label: "Início da vigência",
        type: "datetime-local",
      },
      {
        name: "valid_to",
        label: "Fim exclusivo da vigência",
        type: "datetime-local",
        help: "A tarifa deve cobrir todo o período da locação.",
      },
      { name: "amount", label: "Valor do período principal (R$)" },
    ],
  },
  adicionais: {
    title: "Serviços adicionais",
    singular: "serviço adicional",
    table: "additional_services",
    read: "pricing.read",
    write: "pricing.write",
    search: "name",
    columns: "id,name,unit,amount,active,archived_at,updated_at",
    fields: [
      { name: "name", label: "Nome" },
      {
        name: "unit",
        label: "Unidade de cobrança",
        type: "select",
        options: ["ONCE", "HOUR", "DAY", "WEEK", "MONTH"],
      },
      { name: "amount", label: "Valor unitário (R$)" },
      { name: "active", label: "Ativo", type: "checkbox" },
      {
        name: "public_enabled",
        label: "Publicar este adicional no site",
        type: "checkbox",
      },
    ],
  },
  categorias: {
    title: "Categorias",
    singular: "categoria",
    table: "vehicle_categories",
    read: "categories.read",
    write: "categories.write",
    search: "name",
    columns: "id,name,capacity,active,archived_at,updated_at",
    fields: [
      { name: "name", label: "Nome" },
      { name: "capacity", label: "Capacidade de passageiros", type: "number" },
      features,
      {
        name: "description",
        label: "Descrição",
        type: "textarea",
        optional: true,
      },
      { name: "active", label: "Ativa", type: "checkbox" },
    ],
  },
  frota: {
    title: "Frota",
    singular: "veículo",
    table: "vehicles",
    read: "vehicles.read",
    write: "vehicles.write",
    search: "plate",
    columns:
      "id,plate,make,model,model_year,operational_status,archived_at,updated_at",
    fields: [
      {
        name: "category_id",
        label: "Categoria",
        type: "select",
        lookup: "categorias",
      },
      {
        name: "branch_id",
        label: "Unidade",
        type: "select",
        lookup: "unidades",
      },
      { name: "plate", label: "Placa" },
      {
        name: "chassis",
        label: "Chassi",
        optional: true,
        help: "17 caracteres em maiúsculas; sem I, O e Q.",
      },
      { name: "renavam", label: "RENAVAM", optional: true },
      { name: "make", label: "Marca" },
      { name: "model", label: "Modelo" },
      { name: "version", label: "Versão", optional: true },
      { name: "manufacture_year", label: "Ano de fabricação", type: "number" },
      { name: "model_year", label: "Ano do modelo", type: "number" },
      { name: "color", label: "Cor" },
      {
        name: "fuel",
        label: "Combustível",
        type: "select",
        options: [
          "FLEX",
          "GASOLINE",
          "ETHANOL",
          "DIESEL",
          "ELECTRIC",
          "HYBRID",
          "CNG",
        ],
      },
      {
        name: "transmission",
        label: "Câmbio",
        type: "select",
        options: ["MANUAL", "AUTOMATIC", "CVT"],
      },
      { name: "passengers", label: "Passageiros", type: "number" },
      { name: "doors", label: "Portas", type: "number" },
      { name: "mileage", label: "Quilometragem", type: "number" },
      {
        name: "operational_status",
        label: "Situação operacional",
        type: "select",
        options: ["ACTIVE", "INACTIVE", "MAINTENANCE", "RETIRED"],
      },
      {
        name: "acquired_on",
        label: "Data de aquisição",
        type: "date",
        optional: true,
      },
      features,
      {
        name: "description",
        label: "Descrição",
        type: "textarea",
        optional: true,
      },
      {
        name: "internal_notes",
        label: "Notas internas",
        type: "textarea",
        optional: true,
      },
    ],
  },
  clientes: {
    title: "Clientes",
    singular: "cliente",
    table: "customers",
    read: "customers.read",
    write: "customers.write",
    search: "name",
    columns: "id,name,person_type,tax_document,archived_at,updated_at",
    fields: [
      {
        name: "person_type",
        label: "Tipo de pessoa",
        type: "select",
        options: ["PF", "PJ"],
      },
      { name: "name", label: "Nome / razão social" },
      { name: "tax_document", label: "CPF / CNPJ" },
      { name: "email", label: "E-mail", type: "email" },
      { name: "phone", label: "Telefone com DDD" },
      {
        name: "birth_date",
        label: "Nascimento (PF)",
        type: "date",
        optional: true,
      },
      ...address,
      { name: "notes", label: "Observações", type: "textarea", optional: true },
    ],
  },
  condutores: {
    title: "Condutores",
    singular: "condutor",
    table: "drivers",
    read: "drivers.read",
    write: "drivers.write",
    search: "name",
    columns:
      "id,name,cpf,license_category,license_expires_on,archived_at,updated_at",
    fields: [
      {
        name: "customer_id",
        label: "Cliente responsável",
        type: "select",
        lookup: "clientes",
      },
      { name: "name", label: "Nome completo" },
      { name: "cpf", label: "CPF" },
      { name: "license_number", label: "Número da CNH" },
      {
        name: "license_category",
        label: "Categoria da CNH",
        type: "select",
        options: ["ACC", "A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"],
      },
      {
        name: "license_expires_on",
        label: "Validade da CNH",
        type: "date",
        help: "Cadastro não comprova habilitação. Documento vencido exige regularização antes da retirada.",
      },
    ],
  },
  unidades: {
    title: "Unidades",
    singular: "unidade",
    table: "branches",
    read: "operations.read",
    write: "settings.manage",
    search: "name",
    columns: "id,name,active,archived_at,updated_at",
    fields: [
      { name: "name", label: "Nome" },
      ...address,
      { name: "active", label: "Ativa", type: "checkbox" },
    ],
  },
};
export const valueLabels: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  MAINTENANCE: "Em manutenção",
  RETIRED: "Retirado da frota",
  FLEX: "Flex",
  GASOLINE: "Gasolina",
  ETHANOL: "Etanol",
  DIESEL: "Diesel",
  ELECTRIC: "Elétrico",
  HYBRID: "Híbrido",
  CNG: "GNV",
  MANUAL: "Manual",
  AUTOMATIC: "Automático",
  CVT: "CVT",
  PF: "Pessoa física",
  PJ: "Pessoa jurídica",
  DAY: "Diária",
  WEEK: "Semana",
  MONTH: "Mês",
  HOUR: "Hora",
  ONCE: "Uma vez por locação",
  CALENDAR: "Mês calendário",
  COMMERCIAL: "Mês comercial",
  ELAPSED: "Tempo decorrido",
  LOCAL_DAYS: "Dias no fuso do plano",
  CEIL_PERIOD: "Arredondar para o próximo período",
  DAY_HOUR: "Compor com diária e hora",
  WEEK_DAY_HOUR: "Compor com semana, diária e hora",
  HALF_UP: "Arredondar metade para cima",
  CEIL: "Arredondar para cima",
  TRUNCATE: "Truncar casas excedentes",
  RENTAL: "Somente locação",
  RENTAL_AND_SERVICES: "Locação e serviços",
};
export function formDefaults(
  resource: Resource,
  row?: Record<string, unknown>,
) {
  const address =
    row?.address && typeof row.address === "object" ? row.address : {};
  const policy =
    row?.policy && typeof row.policy === "object" ? row.policy : {};
  const data: Record<string, unknown> = { ...row, ...address, ...policy };
  if (typeof data.amount === "number") data.amount = data.amount.toFixed(2);
  return Object.fromEntries(
    registry[resource].fields.map((field) => [
      field.name,
      field.name === "features"
        ? Array.isArray(data.features)
          ? data.features.join(", ")
          : ""
        : (data[field.name] ??
          (field.type === "checkbox"
            ? field.name !== "public_enabled"
            : field.type === "number"
              ? field.name === "mileage"
                ? 0
                : undefined
              : "")),
    ]),
  );
}
