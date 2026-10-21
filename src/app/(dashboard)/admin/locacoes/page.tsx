import Link from "next/link";
import { z } from "zod";
import { requirePageStaff } from "@/lib/auth/session";
import { listRentals } from "@/lib/rentals/service";
import { RentalList } from "@/components/rentals/rental-list";
import { JobsButton } from "@/components/rentals/operation-form";
import { WorkspaceHeading } from "@/components/business/workspace";
export default async function RentalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { staff } = await requirePageStaff("rentals.read");
  const parsed = z
    .object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      status: z
        .enum(["", "PREPARING", "ACTIVE", "OVERDUE", "COMPLETED", "CANCELLED"])
        .default(""),
    })
    .safeParse(await searchParams);
  if (!parsed.success)
    return (
      <>
        <WorkspaceHeading title="Locações" />
        <p role="alert" className="workspace-alert">
          Filtros inválidos. Revise a consulta.
        </p>
        <Link className="text-link" href="/admin/locacoes">
          Limpar filtros
        </Link>
      </>
    );
  const result = await listRentals(parsed.data);
  return (
    <RentalList
      {...result}
      status={parsed.data.status}
      permissions={staff.permissions}
      jobs={
        staff.permissions.includes("contracts.generate") ? (
          <JobsButton />
        ) : undefined
      }
    />
  );
}
