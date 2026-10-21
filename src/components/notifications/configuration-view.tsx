import {
  BackLink,
  WorkspaceHeading,
  RecordStatus,
} from "@/components/business/workspace";
import { BusinessJobsButton } from "./notification-controls";
import { NotificationConfigurationForm } from "./configuration-form";
import type { notificationConfiguration } from "@/lib/notifications/service";
export function NotificationConfigurationView({
  data,
  emailConfigured,
  timezone,
}: {
  data: Awaited<ReturnType<typeof notificationConfiguration>>;
  emailConfigured: boolean;
  timezone: string;
}) {
  return (
    <div className="administration-workspace">
      <BackLink href="/admin/notificacoes">Voltar para notificações</BackLink>
      <WorkspaceHeading
        title="Mensagens, regras e filas"
        description="Defina o conteúdo dos avisos, os destinatários e acompanhe o processamento."
      />
      <div className="administration-service-state">
        <RecordStatus attention={!emailConfigured}>
          {emailConfigured
            ? "Adaptador de e-mail configurado"
            : "E-mail sem configuração completa"}
        </RecordStatus>
        <p>
          {emailConfigured
            ? "Homologue remetente e entrega antes da operação. Aceite pelo provedor não comprova entrega ao destinatário."
            : "As mensagens no painel funcionam; os e-mails aguardam configuração do servidor."}
        </p>
      </div>
      <nav className="business-tabs" aria-label="Configuração de notificações">
        <a href="#regras">Regras</a>
        <a href="#mensagens">Mensagens</a>
        <a href="#filas">Filas e tentativas</a>
      </nav>
      <NotificationConfigurationForm
        {...data}
        timezone={timezone}
        jobsControl={<BusinessJobsButton />}
      />
    </div>
  );
}
