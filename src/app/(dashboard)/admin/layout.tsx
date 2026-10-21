import { Button } from "@/components/ui/button";
import { requirePageStaff } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import { buildNavigation } from "@/lib/navigation";
import { AdminFrame } from "@/components/layout/admin-frame";
import { AdminNavigation } from "@/components/layout/admin-navigation";
export const dynamic = "force-dynamic";
const roles = {
  ADMIN: "Administração",
  MANAGER: "Gestão",
  ATTENDANT: "Atendimento",
  FINANCE: "Financeiro",
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { staff } = await requirePageStaff();
  return (
    <AdminFrame
      displayName={staff.displayName}
      roleLabel={staff.roles.map((role) => roles[role]).join(" · ")}
      navigation={
        <AdminNavigation groups={buildNavigation(staff.permissions)} />
      }
      logout={
        <form action={logoutAction}>
          <Button
            variant="outline"
            size="sm"
            className="border-white/25 bg-transparent text-white hover:bg-white/10"
            type="submit"
          >
            Sair da conta
          </Button>
        </form>
      }
    >
      {children}
    </AdminFrame>
  );
}
