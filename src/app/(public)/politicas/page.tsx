import { getSite } from "@/lib/public/catalog";
export const dynamic = "force-dynamic";
export default async function Policies() {
  let site;
  try {
    site = await getSite();
  } catch {
    site = null;
  }
  return (
    <main id="conteudo" className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="text-3xl font-bold">Condições de locação e privacidade</h1>
      {site ? (
        <>
          <p className="mt-5 text-sm">Versão de aceite: {site.terms_version}</p>
          <section className="mt-8">
            <h2 className="text-2xl font-bold">Condições de locação</h2>
            <p className="mt-5 whitespace-pre-wrap leading-8">{site.terms}</p>
          </section>
          <section className="mt-10">
            <h2 className="text-2xl font-bold">Política de privacidade</h2>
            <p className="mt-5 whitespace-pre-wrap leading-8">{site.privacy}</p>
          </section>
        </>
      ) : (
        <p className="mt-7" role="status">
          As condições aprovadas pela locadora ainda não estão disponíveis. A
          solicitação online depende dessa publicação.
        </p>
      )}
    </main>
  );
}
