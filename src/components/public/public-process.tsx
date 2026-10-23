import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function PublicProcess() {
  return (
    <section
      className="public-process"
      id="como-funciona"
      aria-labelledby="public-process-title"
    >
      <div className="public-process-inner">
        <div className="public-process-heading">
          <h2 id="public-process-title">Da escolha à retirada</h2>
          <Link href="/reservar">
            Solicitar reserva <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <ol>
          {[
            [
              "Escolha",
              "Escolha a categoria ou o veículo e informe o período.",
            ],
            ["Cotação", "Confira os valores e envie seus dados para análise."],
            [
              "Confirmação",
              "Aguarde a confirmação da equipe. O pagamento é na retirada, conforme as condições da locadora.",
            ],
          ].map(([title, text], i) => (
            <li key={title}>
              <span aria-hidden="true">{i + 1}.</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link className="public-process-policies" href="/politicas">
          Condições de locação e privacidade
        </Link>
      </div>
    </section>
  );
}
