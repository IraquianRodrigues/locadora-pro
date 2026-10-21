import { BackLink, WorkspaceHeading } from "@/components/business/workspace";
import { requirePageStaff, AccessError } from "@/lib/auth/session";
import { lookupOptions } from "@/lib/registry/service";
import { BookingForm } from "@/components/reservations/booking-form";
export default async function NewRentalPage() {
  const { staff } = await requirePageStaff("rentals.create");
  if (
    ![
      "pricing.read",
      "vehicles.read",
      "customers.read",
      "reservations.request",
    ].every((p) => staff.permissions.includes(p))
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
      ).map(async (r) => [r, await lookupOptions(r)]),
    ),
  );
  return (
    <div className="record-editor">
      <BackLink href="/admin/locacoes">Voltar para locações</BackLink>
      <WorkspaceHeading
        title="Nova locação direta"
        description="Selecione um cliente e um veículo específico. A cotação será congelada e a disponibilidade validada ao criar a locação."
      />
      <BookingForm
        options={options}
        canDiscount={staff.permissions.includes("discounts.authorize")}
        mode="rental"
      />
    </div>
  );
}
