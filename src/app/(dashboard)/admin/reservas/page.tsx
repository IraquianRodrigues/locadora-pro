import Link from "next/link";
import { z } from "zod";
import { requirePageStaff } from "@/lib/auth/session";
import { listReservations } from "@/lib/reservations/service";
import { reservationStatuses } from "@/lib/reservations/schema";
import { ExpiryButton } from "@/components/reservations/decision-form";
import { ReservationList } from "@/components/reservations/reservation-list";
import { WorkspaceHeading } from "@/components/business/workspace";
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { staff } = await requirePageStaff("reservations.read"),
    raw = await searchParams;
  const parsed = z
    .object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      status: z.union([z.enum(reservationStatuses), z.literal("")]).default(""),
    })
    .safeParse(raw);
  if (!parsed.success)
    return (
      <>
        <WorkspaceHeading title="Reservas" />
        <p role="alert" className="workspace-notice">
          Filtros inválidos.
        </p>
        <Link href="/admin/reservas" className="text-link">
          Limpar filtros
        </Link>
      </>
    );
  const filters = parsed.data,
    result = await listReservations(filters);
  return (
    <ReservationList
      {...result}
      status={filters.status}
      canRequest={staff.permissions.includes("reservations.request")}
      expiry={
        staff.permissions.includes("reservations.approve") ? (
          <ExpiryButton />
        ) : undefined
      }
    />
  );
}
