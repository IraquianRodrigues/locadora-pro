import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, CarFront, DoorOpen, Users } from "lucide-react";
import type { z } from "zod";
import type { vehicleView } from "@/lib/public/catalog";
export function CatalogCards({
  vehicles,
}: {
  vehicles: z.infer<typeof vehicleView>[];
}) {
  return !vehicles.length ? (
    <div className="public-catalog-empty" role="status">
      <CarFront size={28} strokeWidth={1.5} aria-hidden="true" />
      <div>
        <p>
          Nenhum veículo publicado para estes filtros. Consulte o atendimento.
        </p>
        <Link href="/contato" className="text-link">
          Contato e atendimento <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  ) : (
    <ul className="public-catalog-grid">
      {vehicles.map((v) => (
        <li key={v.id} className="public-vehicle-card">
          {v.image_id ? (
            <Image
              src={`/api/v1/public/images/${v.image_id}`}
              alt={`${v.make} ${v.model}`}
              width={640}
              height={400}
              unoptimized
              className="public-vehicle-image"
            />
          ) : (
            <div className="public-vehicle-placeholder">
              <CarFront size={48} strokeWidth={1.25} aria-hidden="true" />
              <span>Foto não publicada</span>
            </div>
          )}
          <div className="public-vehicle-content">
            <p className="public-vehicle-category">
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
            <ul
              className="public-vehicle-specs"
              aria-label="Características do veículo"
            >
              <li>{v.model_year}</li>
              <li>
                <Users size={16} aria-hidden="true" />
                {v.passengers} passageiros
              </li>
              <li>
                <DoorOpen size={16} aria-hidden="true" />
                {v.doors} portas
              </li>
            </ul>
            <div className="public-vehicle-booking">
              <p>Consulte o valor para o período desejado.</p>
              <Link className="text-link" href={`/reservar?veiculo=${v.id}`}>
                Cotar este veículo <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
