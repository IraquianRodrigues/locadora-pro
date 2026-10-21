import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePageStaff } from "@/lib/auth/session";
import { registry, formDefaults } from "@/lib/registry/config";
import { recordId, resourceSchema } from "@/lib/registry/schema";
import {
  getRecord,
  RegistryError,
  vehicleHistory,
} from "@/lib/registry/service";
import { formOptions } from "@/lib/registry/page-data";
import { RegistryForm } from "@/components/registry/registry-form";
import { ArchiveButton } from "@/components/registry/archive-button";
import { FilesPanel } from "@/components/registry/files-panel";
import {
  fileAllowed,
  fileRules,
  type FileKind,
} from "@/lib/registry/file-schema";
import { listRegistryFiles } from "@/lib/registry/files";
import { brazilToday } from "@/lib/registry/brazil";
import { formatDate } from "@/lib/utils/format";
import { RecordHeader } from "@/components/registry/record-header";
import { businessTimezone } from "@/lib/business/format";
export default async function RecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ resource: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await params,
    parsed = resourceSchema.safeParse(raw.resource);
  if (!parsed.success || !recordId.safeParse(raw.id).success) notFound();
  const resource = parsed.data,
    id = raw.id,
    definition = registry[resource];
  const { staff } = await requirePageStaff(definition.read);
  const search = await searchParams;
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .catch(1)
    .parse(search.historico ?? 1);
  const filePage = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .catch(1)
    .parse(search.arquivos ?? 1);
  let row: Record<string, unknown>;
  try {
    row = await getRecord(resource, id);
  } catch (error) {
    if (error instanceof RegistryError && error.status === 404) notFound();
    throw error;
  }
  const kinds = (Object.keys(fileRules) as FileKind[]).filter(
    (kind) =>
      fileRules[kind].resource === resource &&
      fileAllowed(kind, staff.permissions),
  );
  const [options, files, history] = await Promise.all([
    formOptions(resource, staff.permissions),
    listRegistryFiles(resource, id, filePage),
    resource === "frota" ? vehicleHistory(id, page) : Promise.resolve([]),
  ]);
  const archived = !!row.archived_at,
    writable = staff.permissions.includes(definition.write);
  return (
    <>
      <div className="record-editor">
        <RecordHeader
          resource={resource}
          name={String(row.name ?? row.plate)}
          id={id}
          archived={archived}
          saved={search.salvo === "1"}
          licenseExpired={
            resource === "condutores" &&
            String(row.license_expires_on) < brazilToday()
          }
        />
        <RegistryForm
          key={String(row.updated_at)}
          resource={resource}
          id={id}
          revision={String(row.updated_at)}
          defaults={formDefaults(resource, row)}
          options={options}
          disabled={!writable || archived}
          timezone={businessTimezone()}
        />
        {writable && (
          <div className="archive-section">
            <ArchiveButton
              resource={resource}
              id={id}
              revision={String(row.updated_at)}
              archived={archived}
            />
          </div>
        )}
        {kinds.length > 0 && (
          <>
            <FilesPanel
              ownerId={id}
              kinds={kinds}
              writable={kinds.filter((kind) =>
                fileAllowed(kind, staff.permissions, true),
              )}
              files={files.data}
              archived={archived}
            />
            <nav
              aria-label="Paginação de arquivos"
              className="mt-5 flex gap-5 text-sm"
            >
              {filePage > 1 && (
                <Link
                  className="underline"
                  href={`?arquivos=${filePage - 1}&historico=${page}`}
                >
                  Arquivos anteriores
                </Link>
              )}
              {files.more && (
                <Link
                  className="underline"
                  href={`?arquivos=${filePage + 1}&historico=${page}`}
                >
                  Próximos arquivos
                </Link>
              )}
            </nav>
          </>
        )}
      </div>
      {history.map((item) => (
        <section key={item.table} className="record-history workspace-section">
          <h2 className="text-xl font-bold">{item.title}</h2>
          {item.data === null ? (
            <p className="mt-4 text-sm">
              Seu perfil não permite consultar este histórico.
            </p>
          ) : item.data.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhum registro nesta página.
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {item.data.map((entry) => (
                <li
                  key={String(entry.id)}
                  className="rounded-lg border border-border bg-background p-4 text-sm"
                >
                  <p className="font-semibold">
                    {String(entry.kind ?? "Locação")} · {String(entry.status)}
                  </p>
                  <p className="mt-2">
                    {formatDate(new Date(String(entry.start_at)))} a{" "}
                    {formatDate(new Date(String(entry.end_at)))}
                  </p>
                  {!!entry.description && (
                    <p className="mt-2">{String(entry.description)}</p>
                  )}
                  <p className="mt-2 text-xs break-all text-muted-foreground">
                    {String(entry.id)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {history.length > 0 && (
        <nav
          aria-label="Paginação do histórico"
          className="mt-6 flex gap-5 text-sm"
        >
          {page > 1 && (
            <Link
              className="underline"
              href={`?historico=${page - 1}&arquivos=${filePage}`}
            >
              Histórico anterior
            </Link>
          )}
          {history.some((item) => item.more) && (
            <Link
              className="underline"
              href={`?historico=${page + 1}&arquivos=${filePage}`}
            >
              Próximo histórico
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
