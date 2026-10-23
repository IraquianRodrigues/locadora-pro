import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCatalog } from "@/lib/public/catalog";
import { InteractiveHoverLink } from "@/components/magicui/interactive-hover-button";
import { PublicPageIntro } from "@/components/public/page-intro";
export const dynamic = "force-dynamic";
export default async function VehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let result;
  try {
    result = await getCatalog({}, id);
  } catch {
    return (
      <main id="conteudo" className="public-page public-page-narrow">
        <PublicPageIntro title="Veículo indisponível para consulta" />
        <Link className="mt-5 inline-block underline" href="/catalogo">
          Voltar ao catálogo
        </Link>
      </main>
    );
  }
  const v = result.data[0];
  if (!v) notFound();
  return (
    <main id="conteudo" className="public-page public-page-narrow">
      <Link href="/catalogo" className="underline">
        Voltar ao catálogo
      </Link>
      <h1 className="mt-5 text-3xl font-bold">
        {v.make} {v.model}
      </h1>
      <p className="my-4">
        {v.version} · {v.model_year} · {v.category}
      </p>
      {v.image_id && (
        <Image
          src={`/api/v1/public/images/${v.image_id}`}
          alt={`${v.make} ${v.model}`}
          width={960}
          height={600}
          unoptimized
          className="mb-6 w-full rounded-2xl object-cover"
        />
      )}
      <p className="whitespace-pre-wrap leading-7">{v.description}</p>
      <dl className="my-6 grid grid-cols-2 gap-4">
        {[
          ["Passageiros", v.passengers],
          ["Portas", v.doors],
          ["Combustível", v.fuel],
          ["Câmbio", v.transmission],
          ["Unidade", v.branch],
        ].map(([k, value]) => (
          <div key={String(k)}>
            <dt className="text-sm text-muted-foreground">{k}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {v.features.length > 0 && (
        <ul className="my-6 flex flex-wrap gap-3">
          {v.features.map((f) => (
            <li className="rounded-lg bg-muted p-3" key={f}>
              {f}
            </li>
          ))}
        </ul>
      )}
      <InteractiveHoverLink href={`/reservar?veiculo=${v.id}`}>
        Calcular cotação
      </InteractiveHoverLink>
      <p className="mt-4 text-sm">
        A consulta não garante disponibilidade. Sua solicitação será analisada
        antes da confirmação.
      </p>
    </main>
  );
}
