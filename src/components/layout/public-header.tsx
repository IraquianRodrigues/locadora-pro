"use client";
import Link from "next/link";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { InteractiveHoverLink } from "@/components/magicui/interactive-hover-button";
const links = [
  { href: "/catalogo", label: "Catálogo" },
  { href: "/categorias", label: "Categorias" },
  { href: "/consultar-reserva", label: "Consultar solicitação" },
  { href: "/contato", label: "Contato" },
];
export function PublicHeader() {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  function navigation() {
    return (
      <>
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
            onClick={() => {
              if (menu.current) menu.current.open = false;
            }}
          >
            {item.label}
          </Link>
        ))}
        <Link href="/login" className="public-team-link">
          Área da equipe <ArrowUpRight aria-hidden="true" />
        </Link>
        <InteractiveHoverLink href="/reservar" className="public-nav-reserve">
          Solicitar reserva
        </InteractiveHoverLink>
      </>
    );
  }
  return (
    <header className="public-header">
      <div className="metal-signature" aria-hidden="true" />
      <div className="public-header-inner">
        <Brand />
        <nav aria-label="Navegação principal" className="public-desktop-nav">
          {navigation()}
        </nav>
        <details ref={menu} className="public-mobile-nav">
          <summary>
            <Menu size={20} aria-hidden="true" />
            Menu
          </summary>
          <nav aria-label="Navegação móvel">{navigation()}</nav>
        </details>
      </div>
    </header>
  );
}
