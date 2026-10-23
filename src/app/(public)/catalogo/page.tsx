import Link from "next/link";
import { getCatalog, bookingOptions } from "@/lib/public/catalog";
import { catalogFilters } from "@/lib/public/schema";
import { CatalogCards } from "@/components/public/catalog-cards";
import { Button } from "@/components/ui/button";
import { PublicPageIntro } from "@/components/public/page-intro";
export const dynamic = "force-dynamic";
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = catalogFilters.safeParse(await searchParams);
  if (!parsed.success)
    return (
      <main id="conteudo" className="public-page">
        <PublicPageIntro title="Catálogo" />
        <p role="alert" className="mt-5">
          Filtros inválidos.
        </p>
        <Link href="/catalogo" className="underline">
          Limpar filtros
        </Link>
      </main>
    );
  let catalog, options;
  try {
    [catalog, options] = await Promise.all([
      getCatalog(parsed.data),
      bookingOptions(),
    ]);
  } catch {
    return (
      <main id="conteudo" className="public-page">
        <PublicPageIntro title="Catálogo" />
        <p role="status" className="mt-6">
          Catálogo temporariamente indisponível ou em preparação. Tente
          novamente mais tarde.
        </p>
        <Link href="/contato" className="mt-4 inline-block underline">
          Atendimento
        </Link>
      </main>
    );
  }
  const f = parsed.data,
    page = (p: number) =>
      `/catalogo?${new URLSearchParams({
        ...Object.fromEntries(
          Object.entries(f)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        ),
        page: String(p),
      })}`;
  return (
    <main id="conteudo" className="public-page">
      <PublicPageIntro title="Catálogo de veículos">
        Escolha por categoria ou um veículo específico. O valor depende do
        período e das condições da cotação.
      </PublicPageIntro>
      <form method="get" className="public-filter-form">
        <label>
          Marca ou modelo
          <input name="q" maxLength={100} defaultValue={f.q} />
        </label>
        {[
          ["category", "Categoria", options.categories],
          ["branch", "Unidade", options.branches],
        ].map(([name, label, rows]) => (
          <label key={String(name)}>
            {String(label)}
            <select
              name={String(name)}
              defaultValue={
                name === "category" ? (f.category ?? "") : (f.branch ?? "")
              }
            >
              <option value="">Todas</option>
              {(rows as { id: string; name: string }[]).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <Button>Filtrar catálogo</Button>
        <Link className="py-3 underline" href="/catalogo">
          Limpar
        </Link>
      </form>
      <p className="mb-5">{catalog.meta.total} veículo(s) encontrado(s).</p>
      <CatalogCards vehicles={catalog.data} />
      <nav className="mt-8 flex gap-5" aria-label="Paginação do catálogo">
        {f.page > 1 && (
          <Link className="underline" href={page(f.page - 1)}>
            Anterior
          </Link>
        )}
        <span>Página {f.page}</span>
        {f.page * 24 < catalog.meta.total && (
          <Link className="underline" href={page(f.page + 1)}>
            Próxima
          </Link>
        )}
      </nav>
    </main>
  );
}
