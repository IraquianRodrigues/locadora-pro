"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="conteudo" className="mx-auto max-w-xl px-6 py-24">
      <h1 className="text-3xl font-bold">
        Não foi possível carregar esta página
      </h1>
      <p className="mt-4 leading-7 text-muted-foreground">
        Tente novamente em alguns instantes.
      </p>
      <Button onClick={reset} className="mt-8">
        Tentar novamente
      </Button>
    </main>
  );
}
