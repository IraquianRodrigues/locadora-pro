import Link from "next/link";
import { ArrowLeft, ArrowRight, Inbox } from "lucide-react";

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="workspace-back">
      <ArrowLeft aria-hidden="true" size={16} />
      {children}
    </Link>
  );
}
export function WorkspaceHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading workspace-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function RecordStatus({
  children,
  attention = false,
}: {
  children: React.ReactNode;
  attention?: boolean;
}) {
  return (
    <span
      className={`record-status${attention ? " record-status-attention" : ""}`}
    >
      {children}
    </span>
  );
}
export function EmptyRecords({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="records-empty">
      <Inbox aria-hidden="true" size={28} />
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function RecordPagination({
  page,
  total,
  pageSize,
  href,
  label,
}: {
  page: number;
  total: number;
  pageSize: number;
  href: (page: number) => string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="records-pagination">
      <span>
        Página {page} · {total} resultado(s)
      </span>
      <div>
        {page > 1 && (
          <Link href={href(page - 1)}>
            <ArrowLeft aria-hidden="true" size={16} />
            Anterior
          </Link>
        )}
        {page * pageSize < total && (
          <Link href={href(page + 1)}>
            Próxima
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        )}
      </div>
    </nav>
  );
}
