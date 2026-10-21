import { BackLink, WorkspaceHeading } from "@/components/business/workspace";
import { requirePageStaff, AccessError } from "@/lib/auth/session";
import { lookupOptions } from "@/lib/registry/service";
import { BookingForm } from "@/components/reservations/booking-form";
export default async function NewBookingPage() {
  const { staff } = await requirePageStaff("reservations.request");
  if (
    !staff.permissions.includes("pricing.read") ||
    !staff.permissions.includes("vehicles.read")
  )
    throw new AccessError(403);
  const options = Object.fromEntries(
    await Promise.all(
      (
        [
          "planos",
          "unidades",
          "categorias",
          "frota",
          "clientes",
          "adicionais",
        ] as const
      ).map(async (resource) => [resource, await lookupOptions(resource)]),
    ),
  );
  return (
    <div className="record-editor">
      <BackLink href="/admin/reservas">Voltar para reservas</BackLink>
      <WorkspaceHeading
        title="Nova cotação e reserva"
        description="Escolha uma categoria ou um veículo. Preços e regras comerciais precisam estar configurados. O pedido passa por análise antes da confirmação."
      />
      <BookingForm
        options={options}
        canDiscount={staff.permissions.includes("discounts.authorize")}
      />
    </div>
  );
}
