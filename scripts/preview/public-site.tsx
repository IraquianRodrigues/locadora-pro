import { PublicHeader } from "../../src/components/layout/public-header";
import { PublicHero } from "../../src/components/public/public-hero";
import { CatalogCards } from "../../src/components/public/catalog-cards";
import { PublicFooter } from "../../src/components/public/public-footer";
import { PublicProcess } from "../../src/components/public/public-process";
import PreparationHome from "../../src/components/public/preparation-home";
import type { ComponentProps } from "react";

const vehicles: ComponentProps<typeof CatalogCards>["vehicles"] = [
  "A",
  "B",
  "C",
].map((letter, i) => ({
  id: `10000000-0000-4000-8000-00000000000${i + 1}`,
  category_id: "20000000-0000-4000-8000-000000000001",
  category: "Categoria ilustrativa",
  branch_id: "30000000-0000-4000-8000-000000000001",
  branch: "Unidade de demonstração",
  make: "Veículo",
  model: `de demonstração ${letter}`,
  version: "",
  model_year: 2026,
  passengers: 5,
  doors: 4,
  fuel: "FLEX",
  transmission: "MANUAL",
  description: "Exemplo visual sem veículo real.",
  features: [],
  image_id: null,
}));

export function PublicSitePreview({
  empty,
  preparation,
}: {
  empty: boolean;
  preparation: boolean;
}) {
  return (
    <>
      <aside className="preview-notice" aria-label="Ambiente de demonstração">
        Prévia do site · Dados ilustrativos · Sem banco ou reservas reais
      </aside>
      <div className="public-site">
        <PublicHeader />
        {preparation ? (
          <PreparationHome />
        ) : (
          <main id="conteudo">
            <PublicHero published />
            <section className="public-intro">
              <div className="availability-header">
                <h2>Encontre seu veículo</h2>
                <a className="text-link" href="http://localhost:3000/catalogo">
                  Ver todo o catálogo
                </a>
              </div>
              <CatalogCards vehicles={empty ? [] : vehicles} />
            </section>
            <PublicProcess />
          </main>
        )}
        <PublicFooter published={!preparation} />
      </div>
    </>
  );
}
