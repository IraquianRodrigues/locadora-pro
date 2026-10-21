import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePageStaff } from "@/lib/auth/session";
import { getRental } from "@/lib/rentals/service";
import { RegistryError, lookupOptions } from "@/lib/registry/service";
import { RentalDetail } from "@/components/rentals/rental-detail";
export default async function RentalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { staff } = await requirePageStaff("rentals.read"),
    { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let detail;
  try {
    detail = await getRental(id);
  } catch (e) {
    if (e instanceof RegistryError && e.status === 404) notFound();
    throw e;
  }
  const plans =
    staff.permissions.includes("rentals.extend") &&
    ["PREPARING", "ACTIVE", "OVERDUE"].includes(detail.rental.status)
      ? await lookupOptions("planos")
      : [];
  return (
    <RentalDetail
      detail={detail}
      permissions={staff.permissions}
      plans={plans}
    />
  );
}
