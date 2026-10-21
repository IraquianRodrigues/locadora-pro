import Link from "next/link";
import Image from "next/image";
import { CarFront } from "lucide-react";
import type { z } from "zod";
import type { vehicleView } from "@/lib/public/catalog";
export function CatalogCards({
  vehicles,
}: {
  vehicles: z.infer<typeof vehicleView>[];
}) {
  return !vehicles.length ? (
    <p className="rounded-xl border border-border p-6">
      Nenhum veículo publicado para estes filtros. Consulte o atendimento.
    </p>
  ) : (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {vehicles.map((v) => (
        <li
          key={v.id}
          className="overflow-hidden rounded-2xl border border-border bg-white"
        >
          {v.image_id ? (
            <Image
              src={`/api/v1/public/images/${v.image_id}`}
              alt={`${v.make} ${v.model}`}
              width={640}
              height={400}
              unoptimized
              className="aspect-[8/5] w-full bg-muted object-contain"
            />
          ) : (
            <div className="flex aspect-[8/5] items-center justify-center bg-muted text-muted-foreground">
              <CarFront size={36} aria-hidden="true" />
              <span className="sr-only">Foto não publicada</span>
            </div>
          )}
          <div className="space-y-3 p-5">
            <p className="text-sm text-muted-foreground">
              {v.category} · {v.branch}
            </p>
            <h2 className="text-xl font-bold">
              <Link
                className="hover:text-primary focus-visible:underline"
                href={`/catalogo/${v.id}`}
              >
                {v.make} {v.model}
              </Link>
            </h2>
            <p>
              {v.model_year} · {v.passengers} passageiros · {v.doors} portas
            </p>
            <p className="text-sm">Consulte o valor para o período desejado.</p>
            <Link className="text-link py-2" href={`/reservar?veiculo=${v.id}`}>
              Cotar este veículo
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
