import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="conteudo" className="mx-auto max-w-xl px-6 py-24">
      <p className="text-sm font-semibold text-muted-foreground">404</p>
      <h1 className="mt-4 text-3xl font-bold">Página não encontrada</h1>
      <p className="mt-4 leading-7 text-muted-foreground">
        O endereço pode ter mudado ou ainda não estar disponível.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">Voltar ao início</Link>
      </Button>
    </main>
  );
}
