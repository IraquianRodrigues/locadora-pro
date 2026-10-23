import { StatusForm } from "@/components/public/status-form";
import { PublicPageIntro } from "@/components/public/page-intro";
export const metadata = {
  title: "Consultar solicitação",
  robots: { index: false, follow: false },
};
export default function Consult() {
  return (
    <main id="conteudo" className="public-page public-page-narrow">
      <PublicPageIntro title="Consultar solicitação">
        Informe a referência e o token recebidos ao solicitar. A consulta mostra
        somente a situação; para outras informações, procure o atendimento.
      </PublicPageIntro>
      <StatusForm />
    </main>
  );
}
