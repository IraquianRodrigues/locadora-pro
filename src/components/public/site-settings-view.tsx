import {
  WorkspaceHeading,
  RecordStatus,
} from "@/components/business/workspace";
import { SiteSettings } from "./site-settings";
export function SiteSettingsView({
  initial,
  version,
}: {
  initial: Record<string, unknown>;
  version: number;
}) {
  return (
    <div className="administration-workspace">
      <WorkspaceHeading
        title="Publicação do site"
        description="Revise o contato e os textos aprovados da Apex antes de liberar o catálogo e as solicitações online."
        action={
          <RecordStatus attention={initial.enabled !== true}>
            {initial.enabled === true
              ? "Publicação habilitada"
              : "Publicação desabilitada"}
          </RecordStatus>
        }
      />
      <p className="business-context-note">
        Planos e adicionais também precisam ser publicados em seus cadastros. O
        fluxo online depende da configuração de antispam no servidor.
      </p>
      <nav className="business-tabs" aria-label="Configurações do site">
        <a href="#contato">Contato</a>
        <a href="#politicas">Políticas</a>
        <a href="#publicacao">Publicação</a>
      </nav>
      <SiteSettings initial={initial} version={version} />
    </div>
  );
}
