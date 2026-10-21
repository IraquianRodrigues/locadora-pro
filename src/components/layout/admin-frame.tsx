import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { Brand } from "@/components/layout/brand";
export function AdminFrame({
  children,
  navigation,
  displayName,
  roleLabel,
  logout,
}: {
  children: React.ReactNode;
  navigation: React.ReactNode;
  displayName: string;
  roleLabel: string;
  logout: React.ReactNode;
}) {
  const identity = (
    <div className="admin-user">
      <p className="admin-user-name">{displayName}</p>
      <p className="admin-user-role">{roleLabel}</p>
      {logout}
    </div>
  );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand inverse />
        {navigation}
        {identity}
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <details className="admin-mobile-nav">
            <summary>
              <Menu size={19} aria-hidden="true" />
              Menu Apex
            </summary>
            <div>
              {navigation}
              {identity}
            </div>
          </details>
          <span>Apex · Gestão de locações</span>
          <Link href="/">
            Ver site <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </header>
        <main id="conteudo" className="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
}
