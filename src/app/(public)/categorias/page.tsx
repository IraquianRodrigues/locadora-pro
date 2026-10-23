import Link from "next/link";
import { bookingOptions } from "@/lib/public/catalog";
import { PublicPageIntro } from "@/components/public/page-intro";
export const dynamic = "force-dynamic";
export default async function Categories() {
  let rows: Awaited<ReturnType<typeof bookingOptions>>["categories"];
  try {
    rows = (await bookingOptions()).categories;
  } catch {
    rows = [];
  }
  return (
    <main id="conteudo" className="public-page">
      <PublicPageIntro title="Categorias">
        Na reserva por categoria, a equipe atribui um veículo disponível durante
        a aprovação.
      </PublicPageIntro>
      {!rows.length ? (
        <p className="mt-6" role="status">
          Categorias indisponíveis ou ainda não publicadas.
        </p>
      ) : (
        <ul className="mt-7 grid gap-5 sm:grid-cols-2">
          {rows.map((c) => (
            <li key={c.id} className="rounded-xl border border-border p-5">
              <h2 className="text-xl font-bold">{c.name}</h2>
              <p className="mt-2">Até {c.capacity} passageiros</p>
              <p className="my-3 whitespace-pre-wrap">{c.description}</p>
              <Link className="underline" href={`/catalogo?category=${c.id}`}>
                Ver veículos desta categoria
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
