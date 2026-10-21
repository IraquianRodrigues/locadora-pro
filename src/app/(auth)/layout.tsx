import Image from "next/image";
import { LockKeyhole } from "lucide-react";
import { Brand } from "@/components/layout/brand";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell">
      <aside className="auth-story">
        <Image
          src="/brand/apex-metallic.png"
          alt=""
          fill
          sizes="(max-width: 767px) 1px, 50vw"
          className="auth-story-art"
          priority
        />
        <Brand inverse />
        <div className="auth-story-copy">
          <h2>
            Gestão de
            <br />
            locações Apex.
          </h2>
          <p>
            Frota, pessoas e cada etapa da locação. A operação da Apex em um só
            lugar.
          </p>
        </div>
        <p className="auth-story-foot">
          <LockKeyhole size={16} aria-hidden="true" />
          Acesso exclusivo à equipe Apex
        </p>
      </aside>
      <main id="conteudo" className="auth-content">
        {children}
      </main>
    </div>
  );
}
