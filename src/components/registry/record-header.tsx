import { registry } from "@/lib/registry/config";
import type { Resource } from "@/lib/registry/schema";
const descriptions: Partial<Record<Resource, string>> = {
  categorias:
    "Confira capacidade, características e disponibilidade da categoria.",
  unidades: "Confira o nome, a situação e o endereço de atendimento.",
  planos:
    "Revise contagem, excedentes, caução, logística e prazos deste plano.",
  precos: "Revise plano, escopo, valor e vigência antes de salvar.",
  adicionais:
    "Confira o valor, a unidade de cobrança e a publicação do serviço.",
};
import {
  BackLink,
  RecordStatus,
  WorkspaceHeading,
} from "@/components/business/workspace";
export function RecordHeader({
  resource,
  name,
  id,
  archived = false,
  saved = false,
  licenseExpired = false,
}: {
  resource: Resource;
  name?: string;
  id?: string;
  archived?: boolean;
  saved?: boolean;
  licenseExpired?: boolean;
}) {
  const definition = registry[resource];
  return (
    <>
      <BackLink href={`/admin/${resource}`}>
        Voltar para {definition.title.toLowerCase()}
      </BackLink>
      <WorkspaceHeading
        title={name ?? `Cadastrar ${definition.singular}`}
        description={
          id
            ? (descriptions[resource] ??
              "Consulte os dados e os registros vinculados a este cadastro.")
            : "Preencha os dados reais. Campos opcionais estão indicados."
        }
        action={
          id ? (
            <RecordStatus>
              {archived ? "Arquivado" : "Não arquivado"}
            </RecordStatus>
          ) : undefined
        }
      />
      {id && (
        <details className="record-reference">
          <summary>Referência do cadastro</summary>
          <p>{id}</p>
        </details>
      )}
      {saved && (
        <p role="status" className="workspace-notice">
          Cadastro salvo.
        </p>
      )}
      {licenseExpired && (
        <p role="alert" className="workspace-notice workspace-notice-attention">
          CNH vencida. Regularize o documento antes de autorizar qualquer
          retirada.
        </p>
      )}
    </>
  );
}
