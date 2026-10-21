import Link from "next/link";
import { Settings2 } from "lucide-react";
import type { listNotifications } from "@/lib/notifications/service";
import { businessDate } from "@/lib/business/format";
import {
  WorkspaceHeading,
  RecordStatus,
  EmptyRecords,
  RecordPagination,
} from "@/components/business/workspace";
import { MarkRead } from "./notification-controls";

export function NotificationList({
  result,
  canConfigure,
  timezone,
}: {
  result: Awaited<ReturnType<typeof listNotifications>>;
  canConfigure: boolean;
  timezone: string;
}) {
  const unread = result.rows.filter((n) => !n.read_at).length;
  return (
    <div className="administration-workspace">
      <WorkspaceHeading
        title="Notificações"
        description="Avisos destinados a você, conforme suas permissões atuais."
        action={
          canConfigure ? (
            <Link
              className="business-secondary-link"
              href="/admin/notificacoes/configuracao"
            >
              <Settings2 size={16} aria-hidden="true" />
              Mensagens, regras e filas
            </Link>
          ) : undefined
        }
      />
      {result.rows.length ? (
        <>
          <p className="records-count">
            {result.rows.length} aviso(s) nesta página · {unread} não lido(s)
          </p>
          <ul className="notification-list">
            {result.rows.map((n) => (
              <li key={n.id} className="notification-entry">
                <div className="administration-row-heading">
                  <h2>{n.subject_snapshot || "Aviso da operação"}</h2>
                  <RecordStatus attention={!n.read_at}>
                    {n.read_at ? "Lida" : "Não lida"}
                  </RecordStatus>
                </div>
                <p className="notification-body">
                  {n.body_snapshot ||
                    "Este aviso não possui mensagem registrada."}
                </p>
                <div className="notification-entry-footer">
                  <time dateTime={n.created_at}>
                    {businessDate(n.created_at, timezone)}
                  </time>
                  {!n.read_at && <MarkRead id={n.id} />}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyRecords title="Nenhum aviso disponível">
          As notificações destinadas a você aparecerão aqui quando forem
          processadas.
        </EmptyRecords>
      )}
      <RecordPagination
        page={result.page}
        total={result.total}
        pageSize={20}
        href={(page) => `/admin/notificacoes?page=${page}`}
        label="Paginação de notificações"
      />
    </div>
  );
}
