import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSite, getCatalog } from "@/lib/public/catalog";
import PreparationHome from "@/components/public/preparation-home";
import { PublicHero } from "@/components/public/public-hero";
import { CatalogCards } from "@/components/public/catalog-cards";
import { PublicProcess } from "@/components/public/public-process";
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
      <PublicProcess />
    </main>
  );
}
