import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSite, getCatalog } from "@/lib/public/catalog";
import PreparationHome from "@/components/public/preparation-home";
import { PublicHero } from "@/components/public/public-hero";
import { CatalogCards } from "@/components/public/catalog-cards";
export const dynamic = "force-dynamic";
export default async function Home() {
  let catalog;
  try {
    await getSite();
    catalog = await getCatalog();
  } catch {
    return <PreparationHome />;
  }
  return (
    <main id="conteudo">
      <PublicHero published />
      <section className="public-intro">
        <div className="availability-header">
          <h2>Encontre seu veículo</h2>
          <Link className="text-link" href="/catalogo">
            Ver todo o catálogo <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <CatalogCards vehicles={catalog.data.slice(0, 6)} />
      </section>
      <section className="public-process">
        <div className="public-process-inner">
          <h2>Da escolha à retirada</h2>
          <ol>
            {[
              "Escolha a categoria ou o veículo e informe o período.",
              "Confira os valores e envie seus dados para análise.",
              "Aguarde a confirmação da equipe. O pagamento é na retirada, conforme as condições da locadora.",
            ].map((text, i) => (
              <li key={text}>
                <span aria-hidden="true">{i + 1}.</span>
                <p>{text}</p>
              </li>
            ))}
          </ol>
          <Link
            className="mt-7 inline-block text-sm underline underline-offset-4"
            href="/politicas"
          >
            Condições de locação e privacidade
          </Link>
        </div>
      </section>
    </main>
  );
}
