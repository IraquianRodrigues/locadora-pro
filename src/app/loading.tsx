export default function Loading() {
  return (
    <main id="conteudo" role="status" className="mx-auto max-w-5xl px-6 py-24">
      <span className="sr-only">Carregando página</span>
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <div className="mt-8 h-52 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
    </main>
  );
}
