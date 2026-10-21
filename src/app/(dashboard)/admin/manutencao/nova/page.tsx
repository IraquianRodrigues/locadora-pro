import { BackLink, WorkspaceHeading } from "@/components/business/workspace";
import { businessTimezone } from "@/lib/business/format";
import { requirePageStaff } from "@/lib/auth/session";
import { maintenanceVehicles } from "@/lib/maintenance/service";
import { NewMaintenanceForm } from "@/components/maintenance/maintenance-forms";
import { control } from "@/components/business/command-form";
import { Button } from "@/components/ui/button";
export default async function NewMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePageStaff("maintenance.write");
  const { q = "" } = await searchParams;
  const vehicles = await maintenanceVehicles(q);
  return (
    <div className="record-editor">
      <BackLink href="/admin/manutencao">Voltar para manutenção</BackLink>
      <WorkspaceHeading
        title="Agendar manutenção"
        description="Defina o veículo, o serviço e o período. Os compromissos existentes serão validados ao salvar."
      />
      <form method="get" className="records-filter maintenance-vehicle-filter">
        <label className="records-search">
          Localizar veículo pela placa
          <input
            className={control}
            name="q"
            defaultValue={q}
            maxLength={20}
            pattern="[a-zA-Z0-9]*"
          />
        </label>
        <p className="field-help">
          Até 100 veículos por busca, incluindo os inativos e em manutenção.
        </p>
        <Button variant="outline">Buscar veículos</Button>
      </form>
      <NewMaintenanceForm
        key={q}
        vehicles={vehicles}
        timezone={businessTimezone()}
      />
    </div>
  );
}
