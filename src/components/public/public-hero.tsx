import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Search } from "lucide-react";
import {
  InteractiveHoverButton,
  InteractiveHoverLink,
} from "@/components/magicui/interactive-hover-button";
import { ShineBorder } from "@/components/magicui/shine-border";
export function PublicHero({ published = false }: { published?: boolean }) {
  return (
    <section className="hero" aria-label="Locação de veículos Apex">
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
          <InteractiveHoverLink
            href={published ? "/catalogo" : "#disponibilidade"}
          >
            {published ? "Explorar catálogo" : "Ver disponibilidade do serviço"}
          </InteractiveHoverLink>
          {published && (
            <Link className="text-link" href="/consultar-reserva">
              Consultar solicitação <ArrowUpRight aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
      <div className="hero-visual" aria-hidden="true">
        <Image
          src="/brand/apex-metallic.png"
          alt=""
          fill
          priority
          sizes="(max-width: 767px) 100vw, 50vw"
        />
        <ShineBorder />
        <p className="hero-visual-label">
          <ArrowUpRight size={19} aria-hidden="true" />
          {published
            ? "Apex · Locação de veículos"
            : "Apex · Uma nova etapa está chegando"}
        </p>
      </div>
      {published && (
        <form
          action="/catalogo"
          method="get"
          className="public-quick-search"
          role="search"
          aria-label="Buscar veículos no catálogo"
        >
          <label htmlFor="home-vehicle-search">
            Qual veículo você procura?
          </label>
          <div className="public-search-field">
            <Search size={20} aria-hidden="true" />
            <input
              id="home-vehicle-search"
              name="q"
              maxLength={100}
              placeholder="Busque por marca ou modelo"
            />
          </div>
          <InteractiveHoverButton type="submit">
            Buscar no catálogo
          </InteractiveHoverButton>
        </form>
      )}
    </section>
  );
}
