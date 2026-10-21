import { registry } from "@/lib/registry/config";
export type NavigationItem = { href: string; label: string; icon: string };
export type NavigationGroup = { label: string; items: NavigationItem[] };
export function buildNavigation(
  permissions: readonly string[],
): NavigationGroup[] {
  const can = (permission: string) => permissions.includes(permission);
  const operation: NavigationItem[] = [
    { href: "/admin/dashboard", label: "Visão geral", icon: "dashboard" },
  ];
  if (can("reservations.read"))
    operation.push({
      href: "/admin/reservas",
      label: "Reservas",
      icon: "calendar",
    });
  if (can("rentals.read"))
    operation.push({ href: "/admin/locacoes", label: "Locações", icon: "key" });
  const records = Object.entries(registry)
    .filter(([, m]) => can(m.read))
    .map(([path, m]) => ({
      href: `/admin/${path}`,
      label: m.title,
      icon:
        (
          {
            frota: "car",
            clientes: "users",
            condutores: "driver",
            categorias: "categories",
            unidades: "branch",
            planos: "pricing",
            precos: "pricing",
          } as Record<string, string>
        )[path] ?? "records",
    }));
  const management: NavigationItem[] = [];
  if (can("finance.read"))
    management.push({
      href: "/admin/financeiro",
      label: "Financeiro",
      icon: "finance",
    });
  if (can("maintenance.read"))
    management.push({
      href: "/admin/manutencao",
      label: "Manutenção",
      icon: "wrench",
    });
  if (can("reports.operations") || can("reports.finance"))
    management.push({
      href: "/admin/relatorios",
      label: "Relatórios",
      icon: "reports",
    });
  management.push({
    href: "/admin/notificacoes",
    label: "Notificações",
    icon: "bell",
  });
  if (can("users.manage"))
    management.push({
      href: "/admin/usuarios",
      label: "Acessos da equipe",
      icon: "access",
    });
  if (can("settings.manage"))
    management.push({
      href: "/admin/site",
      label: "Publicação do site",
      icon: "site",
    });
  return [
    { label: "Operação", items: operation },
    { label: "Cadastros", items: records },
    { label: "Gestão", items: management },
  ].filter((g) => g.items.length);
}
