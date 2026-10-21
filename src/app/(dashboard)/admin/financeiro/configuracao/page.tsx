import { BackLink, WorkspaceHeading } from "@/components/business/workspace";
import { requirePageStaff } from "@/lib/auth/session";
import { financeConfiguration } from "@/lib/finance/service";
import { FinanceConfigurationForm } from "@/components/finance/configuration-form";
export default async function FinanceConfigurationPage() {
  await requirePageStaff("settings.manage");
  const data = await financeConfiguration();
  return (
    <div className="record-editor">
      <BackLink href="/admin/financeiro">Voltar para financeiro</BackLink>
      <WorkspaceHeading
        title="Meios e limites financeiros"
        description="Configuração restrita ao administrador. Desativar um meio preserva seu histórico."
      />
      <FinanceConfigurationForm {...data} />
    </div>
  );
}
