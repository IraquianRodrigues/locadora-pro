import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { PublicHero } from "@/components/public/public-hero";
export default function PreparationHome() {
  return (
    <main id="conteudo">
      <PublicHero />
      <section
        id="disponibilidade"
        aria-labelledby="availability-title"
        className="public-intro scroll-mt-6"
      >
        <div className="availability-header">
          <h2 id="availability-title">Estamos cuidando dos detalhes.</h2>
          <span className="availability-status">
            <Clock3 size={15} aria-hidden="true" />
            Em preparação
          </span>
        </div>
        <div className="availability-list">
          <div className="availability-row">
            <h3>Catálogo de veículos</h3>
            <p>A frota e as categorias ainda não foram publicadas.</p>
            <span>Ainda indisponível</span>
          </div>
          <div className="availability-row">
            <h3>Reservas online</h3>
            <p>
              As solicitações serão liberadas após a configuração do
              atendimento.
            </p>
            <span>Ainda indisponível</span>
          </div>
          <div className="availability-row">
            <h3>Área da equipe</h3>
            <p>
              O acesso será liberado aos funcionários autorizados na
              implantação.
            </p>
            <Link className="text-link" href="/login">
              Informações de acesso <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </div>
        <p className="public-note">
          Este site ainda não recebe solicitações de reserva ou pagamentos.
        </p>
      </section>
    </main>
  );
}
