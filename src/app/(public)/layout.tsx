import { PublicHeader } from "@/components/layout/public-header";
import { getSite } from "@/lib/public/catalog";
import { PublicFooter } from "@/components/public/public-footer";
import "@/components/public/public-site.css";
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
    <div className="public-site">
      <PublicHeader />
      {children}
      <PublicFooter name={site?.name} published={Boolean(site)} />
    </div>
  );
}
