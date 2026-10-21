"use client";
import { useState, type ReactNode } from "react";
import type { notificationConfiguration } from "@/lib/notifications/service";
import { notificationEvents } from "@/lib/notifications/schema";
import { businessDate } from "@/lib/business/format";
import {
  CommandForm,
  Field,
  ReasonField,
  control,
  value,
} from "@/components/business/command-form";
import { RecordStatus } from "@/components/business/workspace";
type Config = Awaited<ReturnType<typeof notificationConfiguration>>;
const jobLabels: Record<string, string> = {
  PENDING: "Pendente",
  PROCESSING: "Em processamento",
  COMPLETED: "Processado",
  DONE: "Processado",
  SENT: "Aceito pelo provedor",
  FAILED: "Falha",
  DEAD: "Tentativas esgotadas",
  RETRY: "Aguardando nova tentativa",
  SKIPPED: "Ignorado",
};
const failureMessages: Record<string, string> = {
  EMAIL_NOT_CONFIGURED:
    "O envio de e-mails ainda não foi configurado. Solicite à administração configurar o serviço antes de tentar novamente.",
  DISPATCH_FAILED:
    "Não foi possível criar os avisos deste evento. Revise as regras e as versões de mensagem com a administração antes de reagendar.",
  DELIVERY_FAILED:
    "Não foi possível enviar o e-mail. Confira a configuração e a disponibilidade do serviço antes de tentar novamente.",
  PROVIDER_REJECTED:
    "O serviço de e-mail recusou a mensagem. Confira remetente, destinatário e conteúdo antes de tentar novamente.",
  RATE_LIMIT:
    "O serviço de e-mail atingiu o limite de envios. Aguarde a liberação do serviço antes de tentar novamente.",
  TIMEOUT:
    "O serviço de e-mail não respondeu a tempo. Confira se a mensagem foi aceita antes de reagendar para evitar duplicidade.",
  AMBIGUOUS:
    "Não foi possível confirmar se o e-mail foi aceito. Confira o envio no serviço de e-mail antes de reagendar para evitar duplicidade.",
  IDEMPOTENCY_WINDOW_EXPIRED:
    "O prazo de proteção contra envios duplicados expirou. Peça à administração para conferir se a mensagem foi aceita antes de definir uma nova tentativa. O sistema impede o reenvio automático neste caso.",
  RETRY_EXHAUSTED:
    "O limite de tentativas foi atingido. Revise a causa com a administração antes de reagendar.",
};
export function NotificationConfigurationForm({
  templates,
  routes,
  jobs,
  timezone,
  jobsControl,
}: Config & { timezone: string; jobsControl?: ReactNode }) {
  const [channel, setChannel] = useState("IN_APP");
  return (
    <div>
      <section
        id="regras"
        className="business-section"
        aria-labelledby="regras-title"
      >
        <h2 id="regras-title">Regras de notificação</h2>
        <p className="business-context-note">
          {routes.length} regra(s) cadastrada(s). Confira evento, destinatário e
          versão antes de habilitar.
        </p>
        {routes.map((r) => (
          <div key={r.id} className="notification-rule">
            <div className="administration-row-heading">
              <div>
                <h3>
                  {notificationEvents[
                    r.event_type as keyof typeof notificationEvents
                  ] ?? r.event_type}
                </h3>
                <p>
                  {r.channel === "EMAIL"
                    ? "E-mail do cliente"
                    : r.target === "FINANCE"
                      ? "Painel financeiro"
                      : "Painel operacional"}
                </p>
              </div>
              <RecordStatus attention={!r.enabled}>
                {r.enabled ? "Habilitada" : "Desabilitada"}
              </RecordStatus>
            </div>
            <CommandForm
              collapsible
              domain="notification-setup"
              title={`Salvar regra: ${notificationEvents[r.event_type as keyof typeof notificationEvents] ?? r.event_type}`}
              disclosureLabel={`Editar regra: ${notificationEvents[r.event_type as keyof typeof notificationEvents] ?? r.event_type}`}
              build={(f) => ({
                kind: "ROUTE",
                event_type: r.event_type,
                channel: r.channel,
                target: r.target,
                template_id: value(f, "template_id"),
                enabled: f.get("enabled") === "on",
                expected_updated_at: r.updated_at,
              })}
            >
              <label className="field-label">
                Versão de mensagem
                <select
                  className={control}
                  name="template_id"
                  defaultValue={r.template_id}
                  required
                >
                  {templates
                    .filter((t) => t.channel === r.channel)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.template_key} · v{t.version}
                      </option>
                    ))}
                </select>
              </label>
              <label className="administration-check">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={r.enabled}
                />
                Habilitada
              </label>
            </CommandForm>
          </div>
        ))}
        {!routes.length && (
          <p className="business-context-note">
            Nenhuma regra cadastrada. Crie uma versão de mensagem e vincule-a a
            um evento.
          </p>
        )}
        <CommandForm
          collapsible
          domain="notification-setup"
          title="Cadastrar regra de notificação"
          build={(f) => ({
            kind: "ROUTE",
            event_type: value(f, "event_type"),
            channel,
            target: value(f, "target"),
            template_id: value(f, "template_id"),
            enabled: f.get("enabled") === "on",
            expected_updated_at: null,
          })}
        >
          <label className="field-label">
            Canal
            <select
              className={control}
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="IN_APP">Painel da equipe</option>
              <option value="EMAIL">E-mail do cliente</option>
            </select>
          </label>
          <label className="field-label">
            Evento
            <select
              className={control}
              name="event_type"
              key={`event-${channel}`}
            >
              {Object.entries(notificationEvents)
                .filter(
                  ([e]) =>
                    channel === "IN_APP" || /^(reservation|rental)\./.test(e),
                )
                .map(([e, l]) => (
                  <option key={e} value={e}>
                    {l}
                  </option>
                ))}
            </select>
          </label>
          <label className="field-label">
            Destinatário
            <select className={control} name="target" key={channel}>
              {channel === "EMAIL" ? (
                <option value="CUSTOMER">
                  Cliente vinculado à reserva/locação
                </option>
              ) : (
                <>
                  <option value="OPERATIONS">
                    Equipe com acesso à operação
                  </option>
                  <option value="FINANCE">Equipe com acesso financeiro</option>
                </>
              )}
            </select>
          </label>
          <label className="field-label">
            Modelo
            <select
              className={control}
              name="template_id"
              required
              key={`template-${channel}`}
            >
              <option value="">Escolha</option>
              {templates
                .filter((t) => t.channel === channel)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.template_key} · v{t.version}
                  </option>
                ))}
            </select>
          </label>
          <label className="administration-check">
            <input name="enabled" type="checkbox" />
            Habilitar esta regra
          </label>
          <p className="business-context-note">
            E-mail exige provedor/remetente no servidor. Confira contatos e
            conteúdo antes de habilitar. Não há regra de e-mail habilitada por
            padrão.
          </p>
        </CommandForm>
      </section>
      <section
        id="mensagens"
        className="business-section"
        aria-labelledby="mensagens-title"
      >
        <h2 id="mensagens-title">Versões de mensagem</h2>
        <p className="business-context-note">
          Versões criadas são imutáveis. Para alterar o texto, crie uma nova
          versão e atualize a regra correspondente.
        </p>
        {templates.map((t) => (
          <details
            key={t.id}
            className="business-disclosure notification-template"
          >
            <summary>
              {t.template_key} · v{t.version} ·{" "}
              {t.channel === "EMAIL" ? "E-mail" : "Painel"}
            </summary>
            <div>
              <h3>{t.subject}</h3>
              <p className="notification-body">{t.body}</p>
            </div>
          </details>
        ))}
        {!templates.length && (
          <p className="business-context-note">
            Nenhuma versão de mensagem cadastrada.
          </p>
        )}
        <CommandForm
          collapsible
          domain="notification-setup"
          title="Criar versão de mensagem"
          build={(f) => ({
            kind: "TEMPLATE",
            name: value(f, "name"),
            version: Number(value(f, "version")),
            channel: value(f, "channel"),
            subject: value(f, "subject"),
            body: value(f, "body"),
          })}
        >
          <label className="field-label">
            Nome do modelo
            <input
              className={control}
              name="name"
              required
              maxLength={100}
              pattern="[a-zA-Z0-9_.-]+"
            />
            <span className="business-context-note">
              Letras, números, ponto, hífen ou sublinhado.
            </span>
          </label>
          <label className="field-label">
            Versão
            <input
              className={control}
              name="version"
              type="number"
              required
              min={1}
              step={1}
            />
          </label>
          <label className="field-label">
            Canal
            <select name="channel" className={control}>
              <option value="IN_APP">Painel</option>
              <option value="EMAIL">E-mail</option>
            </select>
          </label>
          <Field name="subject" label="Assunto" />
          <label className="field-label">
            Mensagem
            <textarea
              className={control}
              name="body"
              rows={5}
              minLength={10}
              maxLength={8000}
              required
            />
          </label>
          <p className="business-context-note">
            Variáveis permitidas: {"{reference}"} (referência curta),{" "}
            {"{status}"} (atualização), {"{date}"} (data UTC), {"{event}"}{" "}
            (evento). O conteúdo é texto simples.
          </p>
        </CommandForm>
      </section>
      <section
        id="filas"
        className="business-section"
        aria-labelledby="filas-title"
      >
        <h2 id="filas-title">Filas e tentativas recentes</h2>
        <p className="business-context-note">
          Processar avalia os eventos pendentes e tenta enviar os e-mails
          habilitados. A fila é preservada quando o e-mail não está configurado.
        </p>
        {jobsControl}
        {(
          [
            ["OUTBOX", jobs.outbox],
            ["EMAIL", jobs.email],
          ] as const
        ).map(([kind, items]) => (
          <section
            key={kind}
            className="notification-queue"
            aria-labelledby={`queue-${kind}`}
          >
            <h3 id={`queue-${kind}`}>
              {kind === "EMAIL" ? "E-mails" : "Eventos"}
            </h3>
            {!items.length && (
              <p className="business-context-note">
                Nenhum registro recente nesta fila.
              </p>
            )}
            {items.map((j) => (
              <div key={j.id} className="notification-job">
                <div className="administration-row-heading">
                  <p>
                    {j.event_type
                      ? (notificationEvents[
                          j.event_type as keyof typeof notificationEvents
                        ] ?? j.event_type)
                      : "Envio de e-mail"}
                  </p>
                  <RecordStatus
                    attention={["DEAD", "FAILED"].includes(j.status)}
                  >
                    {jobLabels[j.status] ?? j.status}
                  </RecordStatus>
                </div>
                <p className="business-context-note">
                  {businessDate(j.created_at, timezone)} · {j.attempts}{" "}
                  tentativa(s)
                </p>
                {j.last_error_code && (
                  <p className="business-feedback">
                    {failureMessages[j.last_error_code] ??
                      "O processamento não foi concluído. Consulte a referência com a administração antes de reagendar."}
                  </p>
                )}
                <details className="business-references">
                  <summary>Referência do processamento</summary>
                  <p>{j.id}</p>
                  {j.last_error_code && (
                    <p>Código para suporte: {j.last_error_code}</p>
                  )}
                </details>
                {["DEAD", "FAILED"].includes(j.status) && (
                  <CommandForm
                    collapsible
                    domain="notification-retry"
                    title="Reagendar processamento"
                    build={(f) => ({
                      kind,
                      id: j.id,
                      reason: value(f, "reason"),
                    })}
                  >
                    <ReasonField />
                    <p className="business-context-note">
                      {kind === "EMAIL"
                        ? "Antes de reagendar, confira no serviço de e-mail se a mensagem foi aceita. Se já foi aceita, não reenvie. Em caso de dúvida, peça à administração para verificar. O sistema pode impedir a nova tentativa quando o prazo de proteção contra envios duplicados expirou."
                        : "Revise a causa da falha com a administração antes de reagendar. Uma nova tentativa mantém os controles que evitam mensagens duplicadas."}
                    </p>
                  </CommandForm>
                )}
              </div>
            ))}
          </section>
        ))}
      </section>
    </div>
  );
}
