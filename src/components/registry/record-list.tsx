import Link from "next/link";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registry, valueLabels } from "@/lib/registry/config";
import type { Resource } from "@/lib/registry/schema";
import { maskDocument } from "@/lib/registry/brazil";
import {
  EmptyRecords,
  RecordPagination,
  RecordStatus,
  WorkspaceHeading,
} from "@/components/business/workspace";
import { formatBRL } from "@/lib/pricing/money";
import { businessDate } from "@/lib/business/format";
export type RegistryListProps = {
  resource: Resource;
  data: Record<string, unknown>[];
  meta: { page: number; total: number; pageSize: number };
  filters: { q?: string; archived: string; category?: string; status?: string };
  categories: { id: string; name: string }[];
  writable: boolean;
  timezone?: string;
};
const descriptions: Partial<Record<Resource, string>> = {
  frota: "Consulte os veículos e acompanhe a situação operacional da frota.",
  clientes:
    "Consulte os cadastros e mantenha os dados dos clientes atualizados.",
  condutores:
    "Consulte os condutores, suas categorias e a validade da habilitação.",
  categorias:
    "Organize a frota por capacidade e características compartilhadas.",
  unidades: "Mantenha os pontos de atendimento e seus endereços atualizados.",
  planos: "Defina períodos, excedentes, caução e regras comerciais da locação.",
  precos: "Consulte valores e vigências por plano, categoria ou veículo.",
  adicionais:
    "Organize os serviços que podem acompanhar a locação e sua forma de cobrança.",
};
export function RegistryList({
  resource,
  data,
  meta,
  filters,
  categories,
  writable,
  timezone = "UTC",
}: RegistryListProps) {
  const definition = registry[resource];
  function href(page: number) {
    const query = new URLSearchParams(
      Object.entries(filters)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    );
    query.set("page", String(page));
    return `/admin/${resource}?${query}`;
  }
  const titles =
    resource === "frota"
      ? ["Veículo", "Ano do modelo", "Situação operacional"]
      : resource === "clientes"
        ? ["Cliente", "Documento", "Tipo de pessoa"]
        : resource === "condutores"
          ? ["Condutor", "Documento", "Habilitação"]
          : resource === "categorias"
            ? ["Categoria", "Passageiros", "Situação"]
            : resource === "unidades"
              ? ["Unidade", "Situação", "Cadastro"]
              : resource === "planos"
                ? ["Plano", "Período principal", "Situação"]
                : resource === "precos"
                  ? ["Preço", "Valor por período", "Vigência"]
                  : [
                      "Serviço adicional",
                      "Valor unitário",
                      "Cobrança e situação",
                    ];
  const create = writable ? (
    <Button asChild>
      <Link href={`/admin/${resource}/novo`}>
        <Plus aria-hidden="true" />
        Cadastrar {definition.singular}
      </Link>
    </Button>
  ) : undefined;
  return (
    <>
      <WorkspaceHeading
        title={definition.title}
        description={
          descriptions[resource] ??
          "Consulte, filtre e mantenha os cadastros da operação."
        }
        action={create}
      />
      <form method="get" className="records-filter">
        <label className="records-search">
          {resource === "frota" ? "Buscar por placa" : "Buscar por nome"}
          <span>
            <Search aria-hidden="true" size={18} />
            <input
              name="q"
              type="search"
              defaultValue={filters.q}
              maxLength={100}
              placeholder={
                resource === "frota" ? "Informe a placa" : "Digite o nome"
              }
            />
          </span>
        </label>
        {resource === "frota" && (
          <>
            <label>
              Categoria
              <select name="category" defaultValue={filters.category ?? ""}>
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Situação
              <select name="status" defaultValue={filters.status ?? ""}>
                <option value="">Todas</option>
                {["ACTIVE", "INACTIVE", "MAINTENANCE", "RETIRED"].map((s) => (
                  <option key={s} value={s}>
                    {valueLabels[s]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label>
          Exibir
          <select name="archived" defaultValue={filters.archived}>
            <option value="false">Não arquivados</option>
            <option value="true">Arquivados</option>
          </select>
        </label>
        <Button type="submit" variant="outline">
          Aplicar filtros
        </Button>
        <Link className="records-clear" href={`/admin/${resource}`}>
          Limpar
        </Link>
      </form>
      <div className="records-context">
        <p>
          {meta.total} cadastro(s){" "}
          {filters.archived === "true" ? "arquivado(s)" : "não arquivado(s)"}{" "}
          encontrado(s).
        </p>
        {!writable && <RecordStatus>Consulta somente</RecordStatus>}
      </div>
      {!data.length ? (
        <EmptyRecords title="Nenhum cadastro encontrado">
          Revise os filtros ou{" "}
          {writable
            ? "cadastre um registro para começar."
            : "consulte novamente quando houver registros disponíveis."}
          <Link className="text-link" href={`/admin/${resource}`}>
            Limpar filtros
          </Link>
        </EmptyRecords>
      ) : (
        <table className="records-table">
          <caption className="sr-only">
            {definition.title} · resultados da consulta
          </caption>
          <thead>
            <tr>
              {titles.map((title) => (
                <th scope="col" key={title}>
                  {title}
                </th>
              ))}
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const id = String(row.id),
                name = String(row.name ?? row.plate),
                archived = !!row.archived_at;
              return (
                <tr key={id}>
                  <th scope="row">
                    <Link
                      className="record-name"
                      href={`/admin/${resource}/${id}`}
                    >
                      {name}
                    </Link>
                    {resource === "frota" && (
                      <small>
                        {String(row.make)} {String(row.model)}
                      </small>
                    )}
                    {archived && <small>Arquivado</small>}
                  </th>
                  <td data-label={titles[1]}>
                    {resource === "frota"
                      ? String(row.model_year)
                      : resource === "clientes"
                        ? maskDocument(String(row.tax_document))
                        : resource === "condutores"
                          ? maskDocument(String(row.cpf))
                          : resource === "precos" || resource === "adicionais"
                            ? formatBRL(
                                typeof row.amount === "number"
                                  ? row.amount.toFixed(2)
                                  : String(row.amount),
                              )
                            : resource === "categorias"
                              ? `${String(row.capacity)} passageiro(s)`
                              : resource === "planos"
                                ? (valueLabels[String(row.period_unit)] ??
                                  String(row.period_unit))
                                : row.active === undefined
                                  ? "—"
                                  : row.active
                                    ? "Ativo"
                                    : "Inativo"}
                  </td>
                  <td data-label={titles[2]}>
                    {resource === "frota" ? (
                      <RecordStatus
                        attention={row.operational_status === "MAINTENANCE"}
                      >
                        {valueLabels[String(row.operational_status)] ??
                          String(row.operational_status)}
                      </RecordStatus>
                    ) : resource === "clientes" ? (
                      valueLabels[String(row.person_type)]
                    ) : resource === "condutores" ? (
                      <>
                        <strong>CNH {String(row.license_category)}</strong>
                        <small>
                          Válida até{" "}
                          {String(row.license_expires_on)
                            .split("-")
                            .reverse()
                            .join("/")}
                        </small>
                      </>
                    ) : resource === "precos" ? (
                      <>
                        <span className="registry-validity">
                          <span>
                            De {businessDate(String(row.valid_from), timezone)}
                          </span>
                          <span>
                            Até {businessDate(String(row.valid_to), timezone)}{" "}
                            (exclusivo)
                          </span>
                          <small>Fuso: {timezone}</small>
                        </span>
                      </>
                    ) : resource === "adicionais" ? (
                      <>
                        <strong>
                          {valueLabels[String(row.unit)] ?? String(row.unit)}
                        </strong>
                        <small>{row.active ? "Ativo" : "Inativo"}</small>
                      </>
                    ) : resource === "unidades" ? (
                      <span>{archived ? "Arquivado" : "Não arquivado"}</span>
                    ) : (
                      <RecordStatus attention={row.active === false}>
                        {row.active ? "Ativo" : "Inativo"}
                      </RecordStatus>
                    )}
                  </td>
                  <td className="record-open">
                    <Link
                      href={`/admin/${resource}/${id}`}
                      aria-label={`Abrir ${name}`}
                    >
                      Abrir
                      <ArrowUpRight aria-hidden="true" size={16} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <RecordPagination {...meta} href={href} label="Paginação dos cadastros" />
    </>
  );
}
