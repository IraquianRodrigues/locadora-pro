import { getSite } from "@/lib/public/catalog";
export const dynamic = "force-dynamic";
export default async function Contact() {
  let site;
  try {
    site = await getSite();
  } catch {
    site = null;
  }
  return (
    <main id="conteudo" className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="text-3xl font-bold">Contato e atendimento</h1>
      {site ? (
        <section className="mt-7 space-y-5 rounded-xl border border-border p-6">
          <h2 className="text-xl font-bold">{site.name}</h2>
          <p>
            <a className="underline" href={`tel:+55${site.phone}`}>
              {site.phone}
            </a>
          </p>
          <p>
            <a className="underline" href={`mailto:${site.email}`}>
              {site.email}
            </a>
          </p>
          <p className="whitespace-pre-wrap">{site.address}</p>
        </section>
      ) : (
        <p className="mt-7" role="status">
          Os canais de atendimento ainda não foram publicados. Tente novamente
          mais tarde.
        </p>
      )}
    </main>
  );
}
