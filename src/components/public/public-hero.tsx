import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
export function PublicHero({ published = false }: { published?: boolean }) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <h1>
          Locação de <em>veículos.</em>
          <br />
          Apex.
        </h1>
        <p>
          {published
            ? "Escolha um veículo ou categoria, confira sua cotação e solicite uma reserva. Nossa equipe analisa a disponibilidade antes de confirmar."
            : "A Apex está preparando sua experiência de locação online. Em breve, você poderá conhecer a frota e solicitar sua reserva por aqui."}
        </p>
        <div className="hero-actions">
          <Button asChild size="lg">
            <Link href={published ? "/catalogo" : "#disponibilidade"}>
              {published
                ? "Explorar catálogo"
                : "Ver disponibilidade do serviço"}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          {published && (
            <Link className="text-link" href="/consultar-reserva">
              Consultar solicitação <ArrowUpRight aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
      <div className="hero-visual">
        <Image
          src="/brand/apex-metallic.png"
          alt=""
          fill
          priority
          sizes="(max-width: 767px) 100vw, 50vw"
        />
        <p className="hero-visual-label">
          <ArrowUpRight size={19} aria-hidden="true" />
          {published
            ? "Apex · Locação de veículos"
            : "Apex · Uma nova etapa está chegando"}
        </p>
      </div>
    </section>
  );
}
