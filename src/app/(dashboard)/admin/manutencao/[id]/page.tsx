import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePageStaff } from "@/lib/auth/session";
import { RegistryError } from "@/lib/registry/service";
import { getMaintenance } from "@/lib/maintenance/service";
import { financeOptions } from "@/lib/finance/service";
import { businessTimezone } from "@/lib/business/format";
import { MaintenanceDetailView } from "@/components/maintenance/maintenance-view";
export default async function MaintenanceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { staff } = await requirePageStaff("maintenance.read"),
    { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let data;
  try {
    data = await getMaintenance(id);
  } catch (e) {
    if (e instanceof RegistryError && e.status === 404) notFound();
    throw e;
  }
  const expense =
      staff.permissions.includes("expenses.write") &&
      staff.permissions.includes("finance.read"),
    methods = expense ? (await financeOptions()).methods : [];
  return (
    <MaintenanceDetailView
      data={data}
      permissions={staff.permissions}
      methods={methods}
      timezone={businessTimezone()}
    />
  );
}
