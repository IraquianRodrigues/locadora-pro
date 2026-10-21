import { BackLink, WorkspaceHeading } from "@/components/business/workspace";
import { requirePageStaff } from "@/lib/auth/session";
import { rentalSettings } from "@/lib/rentals/service";
import { operationalPolicySchema } from "@/lib/rentals/schema";
import { RentalSettingsForm } from "@/components/rentals/settings-form";
export default async function RentalConfigurationPage() {
  await requirePageStaff("settings.manage");
  const data = await rentalSettings(),
    policy = operationalPolicySchema.safeParse(data.policy?.value);
  return (
    <div className="record-editor rental-settings">
      <BackLink href="/admin/locacoes">Voltar para locações</BackLink>
      <WorkspaceHeading
        title="Regras e modelos de locação"
        description="Crie os modelos versionados e aprove juridicamente o contrato antes de configurar a operação."
      />
      <RentalSettingsForm
        policy={policy.success ? policy.data : null}
        updatedAt={data.policy?.updated_at ?? null}
        contracts={data.templates}
        inspections={data.inspections}
        company={data.company}
      />
    </div>
  );
}
