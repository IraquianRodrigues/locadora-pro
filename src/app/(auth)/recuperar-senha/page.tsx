import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { authConfigured } from "@/lib/auth/config";
export const dynamic = "force-dynamic";
export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-bold tracking-tight">Recuperar senha</h1>
      <p className="mt-3 text-muted-foreground">
        Informe seu e-mail para receber as instruções.
      </p>
      {params.link === "invalido" && (
        <p role="alert" className="mt-5 text-sm">
          Link inválido, expirado ou já utilizado. Solicite um novo link.
        </p>
      )}
      <AuthForm mode="recovery" enabled={authConfigured()} />
      <Link
        href="/login"
        className="mt-6 inline-block text-sm underline underline-offset-4"
      >
        Voltar ao login
      </Link>
    </div>
  );
}
