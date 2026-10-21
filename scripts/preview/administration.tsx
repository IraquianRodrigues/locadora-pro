import { NotificationList } from "../../src/components/notifications/notification-list";
import { NotificationConfigurationView } from "../../src/components/notifications/configuration-view";
import {
  UsersView,
  type TeamProfile,
} from "../../src/components/users/users-view";
import { SiteSettingsView } from "../../src/components/public/site-settings-view";
import type { notificationConfiguration } from "../../src/lib/notifications/service";
import { setStaffAccessAction } from "./actions";
const timezone = "America/Fortaleza";
const id = (n: number) => `7000000${n}-0000-4000-8000-00000000000${n}`;
export const demoNotificationConfiguration: Awaited<
  ReturnType<typeof notificationConfiguration>
> = {
  templates: [
    {
      id: id(1),
      template_key: "demonstracao.reserva",
      version: 1,
      channel: "IN_APP",
      subject: "Nova solicitação para análise",
      body: "A reserva {reference} foi solicitada. Consulte a operação para verificar os dados. Texto ilustrativo.",
    },
    {
      id: id(2),
      template_key: "demonstracao.email",
      version: 1,
      channel: "EMAIL",
      subject: "Atualização da solicitação",
      body: "A solicitação {reference} tem uma atualização: {status}. Texto ilustrativo, sem envio real.",
    },
  ],
  routes: [
    {
      id: id(3),
      event_type: "reservation.requested",
      channel: "IN_APP",
      target: "OPERATIONS",
      template_id: id(1),
      enabled: true,
      updated_at: "2026-10-21T12:00:00Z",
    },
    {
      id: id(4),
      event_type: "reservation.confirmed",
      channel: "EMAIL",
      target: "CUSTOMER",
      template_id: id(2),
      enabled: false,
      updated_at: "2026-10-21T12:00:00Z",
    },
  ],
  jobs: {
    outbox: [
      {
        id: id(5),
        event_type: "reservation.requested",
        status: "COMPLETED",
        attempts: 1,
        last_error_code: null,
        created_at: "2026-10-21T12:00:00Z",
      },
      {
        id: id(6),
        event_type: "maintenance.due",
        status: "DEAD",
        attempts: 5,
        last_error_code: "DEMO_PROCESSING_FAILURE",
        created_at: "2026-10-21T11:00:00Z",
      },
    ],
    email: [
      {
        id: id(7),
        status: "FAILED",
        attempts: 2,
        last_error_code: "EMAIL_NOT_CONFIGURED",
        created_at: "2026-10-21T11:30:00Z",
      },
    ],
  },
};
export const demoTeam: TeamProfile[] = [
  {
    id: id(1),
    display_name: "Administração de demonstração",
    active: true,
    role: "ADMIN",
  },
  {
    id: id(2),
    display_name: "Atendimento de demonstração",
    active: true,
    role: "ATTENDANT",
  },
  {
    id: id(3),
    display_name: "Financeiro de demonstração",
    active: false,
    role: "FINANCE",
  },
  { id: id(4), display_name: "Novo perfil de demonstração", active: false },
];
export function AdministrationPreview({
  url,
  empty,
  permissions,
}: {
  url: URL;
  empty: boolean;
  permissions: string[];
}) {
  const parts = url.pathname.split("/"),
    canConfigure = permissions.includes("settings.manage");
  if (
    (parts[2] === "usuarios" && !permissions.includes("users.manage")) ||
    ((parts[2] === "site" || parts[3] === "configuracao") && !canConfigure)
  )
    return (
      <>
        <h1>Acesso restrito</h1>
        <p>Este perfil ilustrativo não tem permissão para esta área.</p>
      </>
    );
  if (parts[2] === "usuarios")
    return (
      <UsersView
        profiles={empty ? [] : demoTeam}
        cursor={url.searchParams.get("depois") ?? undefined}
        hasNext={url.searchParams.has("more")}
        result={url.searchParams.get("resultado") ?? undefined}
        action={setStaffAccessAction}
      />
    );
  if (parts[2] === "site")
    return (
      <SiteSettingsView
        initial={
          empty
            ? {}
            : {
                enabled: false,
                name: "Apex · demonstração",
                email: "atendimento@example.invalid",
                phone: "85999990000",
                address: "Endereço ilustrativo de atendimento · Fortaleza/CE",
                terms:
                  "Texto ilustrativo para revisão visual. Substituir pelas condições de locação, cancelamento e pagamento aprovadas pela empresa antes da publicação.",
                privacy:
                  "Texto ilustrativo para revisão visual. Substituir pela política de privacidade aprovada pela empresa antes de publicar o site.",
              }
        }
        version={empty ? 0 : 2}
      />
    );
  if (parts[3] === "configuracao")
    return (
      <NotificationConfigurationView
        data={
          empty
            ? { templates: [], routes: [], jobs: { outbox: [], email: [] } }
            : demoNotificationConfiguration
        }
        emailConfigured={url.searchParams.has("configured")}
        timezone={timezone}
      />
    );
  const page = Number(url.searchParams.get("page") ?? 1);
  return (
    <NotificationList
      result={{
        rows: empty
          ? []
          : [
              {
                id: id(1),
                subject_snapshot: "Solicitação de reserva para análise",
                body_snapshot:
                  "Uma nova solicitação aguarda avaliação da equipe. Confira o período e a disponibilidade antes de confirmar.\nAviso ilustrativo, sem reserva real.",
                read_at: null,
                created_at: "2026-10-21T12:00:00Z",
              },
              {
                id: id(2),
                subject_snapshot: "Revisão de manutenção programada",
                body_snapshot:
                  "Há um serviço previsto no exemplo de manutenção. Consulte o veículo e o período antes de organizar a agenda. Dados ilustrativos.",
                read_at: null,
                created_at: "2026-10-21T11:00:00Z",
              },
              {
                id: id(3),
                subject_snapshot: "Devolução registrada no exemplo",
                body_snapshot:
                  "A operação ilustrativa de devolução foi concluída. Este aviso demonstra o estado de uma mensagem já lida.",
                read_at: "2026-10-21T11:00:00Z",
                created_at: "2026-10-21T10:00:00Z",
              },
            ],
        page,
        total: empty ? 0 : url.searchParams.has("more") ? 23 : 3,
      }}
      canConfigure={canConfigure}
      timezone={timezone}
    />
  );
}
