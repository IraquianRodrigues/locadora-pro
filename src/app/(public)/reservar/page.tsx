import { z } from "zod";
import { PublicBooking } from "@/components/public/booking";
import { PublicPageIntro } from "@/components/public/page-intro";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Solicitar reserva",
  robots: { index: false, follow: false },
};
export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).veiculo,
    id = z.uuid().safeParse(raw);
  return (
    <main id="conteudo" className="public-page public-page-narrow">
      <PublicPageIntro title="Cotação e solicitação de reserva">
        Confira as condições e envie sua solicitação. A reserva depende de
        análise e confirmação da equipe; o pagamento será na retirada.
      </PublicPageIntro>
      <PublicBooking vehicleId={id.success ? id.data : undefined} />
    </main>
  );
}
