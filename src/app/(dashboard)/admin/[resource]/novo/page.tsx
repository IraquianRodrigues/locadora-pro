import { notFound } from "next/navigation";
import { requirePageStaff } from "@/lib/auth/session";
import { registry, formDefaults } from "@/lib/registry/config";
import { resourceSchema } from "@/lib/registry/schema";
import { formOptions } from "@/lib/registry/page-data";
import { RegistryForm } from "@/components/registry/registry-form";
import { RecordHeader } from "@/components/registry/record-header";
import { businessTimezone } from "@/lib/business/format";
export default async function NewRegistryPage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const parsed = resourceSchema.safeParse((await params).resource);
  if (!parsed.success) notFound();
  const resource = parsed.data,
    definition = registry[resource];
  const { staff } = await requirePageStaff(definition.write);
  const options = await formOptions(resource, staff.permissions);
  return (
    <div className="record-editor">
      <RecordHeader resource={resource} />
      <RegistryForm
        resource={resource}
        defaults={formDefaults(resource)}
        options={options}
        disabled={false}
        timezone={businessTimezone()}
      />
    </div>
  );
}
