import { z } from "zod";
import { PublicBooking } from "@/components/public/booking";
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
    <main id="conteudo" className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="text-3xl font-bold">Cotação e solicitação de reserva</h1>
      <p className="my-5">
        Confira as condições e envie sua solicitação. A reserva depende de
        análise e confirmação da equipe; o pagamento será na retirada.
      </p>
      <PublicBooking vehicleId={id.success ? id.data : undefined} />
    </main>
  );
}
