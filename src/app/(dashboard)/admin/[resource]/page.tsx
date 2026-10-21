import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageStaff } from "@/lib/auth/session";
import { registry } from "@/lib/registry/config";
import { resourceSchema, listSchema } from "@/lib/registry/schema";
import { listRecords, lookupOptions } from "@/lib/registry/service";
import { RegistryList } from "@/components/registry/record-list";
import { WorkspaceHeading } from "@/components/business/workspace";
import { businessTimezone } from "@/lib/business/format";
export default async function RegistryPage({
  params,
  searchParams,
}: {
  params: Promise<{ resource: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = resourceSchema.safeParse((await params).resource);
  if (!parsed.success) notFound();
  const resource = parsed.data,
    definition = registry[resource];
  const { staff } = await requirePageStaff(definition.read);
  const filterResult = listSchema.safeParse(await searchParams);
  if (!filterResult.success)
    return (
      <>
        <WorkspaceHeading title={definition.title} />
        <p role="alert" className="workspace-notice">
          Filtros inválidos.
        </p>
        <Link href={`/admin/${resource}`} className="text-link">
          Limpar filtros
        </Link>
      </>
    );
  const filters = filterResult.data;
  const [{ data, meta }, categories] = await Promise.all([
    listRecords(resource, filters),
    resource === "frota" && staff.permissions.includes("categories.read")
      ? lookupOptions("categorias")
      : Promise.resolve([]),
  ]);
  return (
    <RegistryList
      resource={resource}
      data={data}
      meta={meta}
      filters={filters}
      categories={categories}
      writable={staff.permissions.includes(definition.write)}
      timezone={businessTimezone()}
    />
  );
}
