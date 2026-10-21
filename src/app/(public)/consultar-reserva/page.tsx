import { StatusForm } from "@/components/public/status-form";
export const metadata = {
  title: "Consultar solicitação",
  robots: { index: false, follow: false },
};
export default function Consult() {
  return (
    <main id="conteudo" className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-bold">Consultar solicitação</h1>
      <p className="mt-5">
        Informe a referência e o token recebidos ao solicitar. A consulta mostra
        somente a situação; para outras informações, procure o atendimento.
      </p>
      <StatusForm />
    </main>
  );
}
