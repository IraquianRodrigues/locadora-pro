import { PublicHeader } from "@/components/layout/public-header";
import Link from "next/link";
import { getSite } from "@/lib/public/catalog";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  try {
    const site = await getSite();
    return {
      title: {
        default: `${site.name} | Locação de veículos`,
        template: `%s | ${site.name}`,
      },
      description:
        "Consulte o catálogo, calcule sua cotação e solicite uma reserva para análise.",
      robots: { index: true, follow: true },
    };
  } catch {
    return {};
  }
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let site;
  try {
    site = await getSite();
  } catch {
    site = null;
  }
  return (
    <>
      <PublicHeader />
      {children}
      <footer className="public-footer">
        <div className="public-footer-inner">
          <p>{site?.name ?? "Apex"} · Locação de veículos</p>
          <Link className="underline" href="/politicas">
            Condições e privacidade
          </Link>
          {!site && <p>Atendimento online em preparação</p>}
        </div>
      </footer>
    </>
  );
}
