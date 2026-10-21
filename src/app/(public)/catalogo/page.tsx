import Link from "next/link";
import { getCatalog, bookingOptions } from "@/lib/public/catalog";
import { catalogFilters } from "@/lib/public/schema";
import { CatalogCards } from "@/components/public/catalog-cards";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = catalogFilters.safeParse(await searchParams);
  if (!parsed.success)
    return (
      <main id="conteudo" className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-3xl font-bold">Catálogo</h1>
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
      <main id="conteudo" className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-3xl font-bold">Catálogo</h1>
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
    <main id="conteudo" className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-3xl font-bold">Catálogo de veículos</h1>
      <p className="mt-4">
        Escolha por categoria ou um veículo específico. O valor depende do
        período e das condições da cotação.
      </p>
      <form
        method="get"
        className="my-8 flex flex-wrap items-end gap-4 rounded-xl border border-border p-5"
      >
        <label>
          Marca ou modelo
          <input
            name="q"
            maxLength={100}
            defaultValue={f.q}
            className="mt-2 block min-h-11 rounded border border-border px-3"
          />
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
              className="mt-2 block min-h-11 max-w-full rounded border border-border bg-white px-3"
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
