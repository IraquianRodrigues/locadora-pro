import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/layout/brand";

export function PublicFooter({
  name = "Apex",
  published = false,
}: {
  name?: string;
  published?: boolean;
}) {
  return (
    <footer className="public-footer">
      <div className="public-footer-main">
        <div className="public-footer-brand">
          <Brand />
          <p>{name} · Locação de veículos</p>
        </div>
        <nav aria-label="Catálogo e reservas">
          <h2>Encontre seu veículo</h2>
          <Link href="/catalogo">
            Catálogo <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <Link href="/categorias">Categorias</Link>
          <Link href="/reservar">Solicitar reserva</Link>
        </nav>
        <nav aria-label="Atendimento e informações">
          <h2>Conte com a Apex</h2>
          <Link href="/consultar-reserva">Consultar solicitação</Link>
          <Link href="/contato">Contato e atendimento</Link>
          <Link href="/login">Área da equipe</Link>
        </nav>
      </div>
      <div className="public-footer-inner">
        <p>
          {published
            ? "Solicitações sujeitas à análise e confirmação da equipe."
            : "Atendimento online em preparação"}
        </p>
        <Link href="/politicas">
          Condições e privacidade <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </footer>
  );
}
