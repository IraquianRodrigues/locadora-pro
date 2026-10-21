import { registry, type Field } from "./config";
import type { Resource } from "./schema";
type Group = { title: string; description?: string; fields: Field[] };
const groups: Partial<
  Record<Resource, { title: string; description?: string; names: string[] }[]>
> = {
  categorias: [
    { title: "Identificação da categoria", names: ["name", "capacity"] },
    {
      title: "Características e descrição",
      names: ["features", "description"],
    },
    { title: "Disponibilidade do cadastro", names: ["active"] },
  ],
  unidades: [
    { title: "Identificação da unidade", names: ["name", "active"] },
    {
      title: "Endereço de atendimento",
      names: [
        "postal_code",
        "street",
        "number",
        "complement",
        "district",
        "city",
        "state",
      ],
    },
  ],
  planos: [
    {
      title: "Identificação e período",
      names: ["name", "period_unit", "active"],
    },
    {
      title: "Contagem e mês de referência",
      description:
        "O modo mensal e os dias comerciais se aplicam somente a planos mensais. Para diária ou semana, deixe ambos vazios. No mês calendário, deixe os dias comerciais vazios.",
      names: [
        "timezone",
        "duration_basis",
        "month_mode",
        "commercial_month_days",
        "minimum_periods",
        "tolerance_minutes",
      ],
    },
    {
      title: "Excedentes e arredondamento",
      description:
        "Pacotes com dia e hora exigem valores explícitos para ambos. A composição com semana também exige o valor da semana excedente. Valores aceitam vírgula ou ponto decimal, sem separador de milhar.",
      names: [
        "strategy",
        "hour_increment_minutes",
        "rounding",
        "week_amount",
        "day_amount",
        "hour_amount",
      ],
    },
    {
      title: "Caução e logística",
      description:
        "A caução fica separada do preço da locação. Confira os valores mesmo quando entrega ou coleta estiverem desabilitadas.",
      names: [
        "deposit_amount",
        "delivery_enabled",
        "delivery_amount",
        "collection_enabled",
        "collection_amount",
        "turnaround_minutes",
      ],
    },
    {
      title: "Descontos e prazos",
      description:
        "Limites em pontos base: 100 equivale a 1%. Esses limites seguem as permissões e regras comerciais existentes.",
      names: [
        "discount_scope",
        "admin_discount_bps",
        "manager_discount_bps",
        "quote_validity_minutes",
        "request_validity_minutes",
        "lookup_validity_days",
      ],
    },
    {
      title: "Publicação do plano",
      description:
        "Publicar o plano depende também da liberação do site e de preços válidos para o período consultado.",
      names: ["public_enabled"],
    },
  ],
  precos: [
    {
      title: "Identificação e vínculo",
      description:
        "Escolha um plano e, exclusivamente, uma categoria ou um veículo. Deixe o outro vínculo vazio.",
      names: ["name", "rate_plan_id", "category_id", "vehicle_id"],
    },
    {
      title: "Valor e vigência",
      description:
        "O preço deve cobrir todo o período da locação. O fim da vigência é exclusivo; sobreposições para o mesmo plano e escopo são verificadas pelo banco.",
      names: ["amount", "valid_from", "valid_to"],
    },
  ],
  adicionais: [
    {
      title: "Serviço e cobrança",
      description:
        "O valor corresponde à unidade de cobrança selecionada. Use vírgula ou ponto decimal, sem separador de milhar.",
      names: ["name", "unit", "amount"],
    },
    {
      title: "Disponibilidade e publicação",
      description:
        "A publicação do adicional depende também da liberação do site.",
      names: ["active", "public_enabled"],
    },
  ],
  frota: [
    {
      title: "Identificação do veículo",
      names: [
        "plate",
        "make",
        "model",
        "version",
        "manufacture_year",
        "model_year",
        "color",
      ],
    },
    {
      title: "Características",
      names: [
        "category_id",
        "fuel",
        "transmission",
        "passengers",
        "doors",
        "features",
        "description",
      ],
    },
    {
      title: "Operação e documentação",
      names: [
        "branch_id",
        "operational_status",
        "mileage",
        "chassis",
        "renavam",
        "acquired_on",
        "internal_notes",
      ],
    },
  ],
  clientes: [
    {
      title: "Identificação do cliente",
      names: ["person_type", "name", "tax_document", "birth_date"],
    },
    { title: "Contato", names: ["email", "phone"] },
    {
      title: "Endereço",
      names: [
        "postal_code",
        "street",
        "number",
        "complement",
        "district",
        "city",
        "state",
      ],
    },
    { title: "Observações", names: ["notes"] },
  ],
  condutores: [
    { title: "Identificação e vínculo", names: ["customer_id", "name", "cpf"] },
    {
      title: "Habilitação",
      description:
        "Confira o documento antes de autorizar a retirada do veículo.",
      names: ["license_number", "license_category", "license_expires_on"],
    },
  ],
};
export function registryFieldGroups(resource: Resource): Group[] {
  const fields = registry[resource].fields;
  if (!groups[resource]) return [{ title: "Dados do cadastro", fields }];
  const result = groups[resource].map((group) => ({
    title: group.title,
    description: group.description,
    fields: group.names.flatMap((name) =>
      fields.filter((field) => field.name === name),
    ),
  }));
  const assigned = new Set(
    result.flatMap((group) => group.fields.map((field) => field.name)),
  );
  const remaining = fields.filter((field) => !assigned.has(field.name));
  if (remaining.length)
    result.push({
      title: "Outros dados",
      description: undefined,
      fields: remaining,
    });
  return result;
}
