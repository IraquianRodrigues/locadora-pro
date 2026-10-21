import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePageStaff } from "@/lib/auth/session";
import { getReservation, getQuote } from "@/lib/reservations/service";
import { RegistryError } from "@/lib/registry/service";
import { DecisionForm } from "@/components/reservations/decision-form";
import { ReservationDetail } from "@/components/reservations/reservation-detail";
import { ConvertReservation } from "@/components/rentals/operation-form";
export default async function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { staff } = await requirePageStaff("reservations.read"),
    { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let r;
  try {
    r = await getReservation(id);
  } catch (error) {
    if (error instanceof RegistryError && error.status === 404) notFound();
    throw error;
  }
  const quote = staff.permissions.includes("pricing.read")
    ? await getQuote(r.quote_id)
    : null;
  return (
    <ReservationDetail
      reservation={r}
      quote={quote}
      permissions={staff.permissions}
      decision={
        <DecisionForm
          id={id}
          version={r.version}
          status={r.status}
          permissions={staff.permissions}
          expired={r.analysis_expired}
        />
      }
      conversion={
        r.status === "CONFIRMED" &&
        staff.permissions.includes("rentals.create") ? (
          <ConvertReservation id={id} version={r.version} />
        ) : undefined
      }
    />
  );
}
