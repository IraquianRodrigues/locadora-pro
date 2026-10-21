import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { authConfigured } from "@/lib/auth/config";
import { safeNext } from "@/lib/auth/security";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <div className="w-full max-w-md">
      <h1>Área da equipe</h1>
      <p className="mt-3 text-muted-foreground">
        Entre com o acesso liberado pelo administrador.
      </p>
      {params.senha === "atualizada" && (
        <p role="status" className="mt-5 rounded-lg bg-muted p-4 text-sm">
          Senha atualizada. Entre novamente.
        </p>
      )}
      {params.saida === "ok" && (
        <p role="status" className="mt-5 text-sm">
          Sessão encerrada.
        </p>
      )}
      {params.saida === "falhou" && (
        <div
          role="alert"
          className="mt-5 space-y-3 rounded-lg border border-border p-4 text-sm"
        >
          <p>
            Não foi possível confirmar o encerramento da sessão. Tente
            novamente.
          </p>
          <form action={logoutAction}>
            <Button variant="outline" type="submit">
              Tentar sair novamente
            </Button>
          </form>
        </div>
      )}
      <AuthForm
        mode="login"
        enabled={authConfigured()}
        next={safeNext(params.next)}
      />
      {params.link === "invalido" && (
        <p role="alert" className="mt-5 text-sm">
          Link inválido, expirado ou não autorizado. Solicite uma nova
          recuperação de senha.
        </p>
      )}
      <div className="mt-6 flex justify-between gap-4 text-sm">
        <Link className="underline underline-offset-4" href="/recuperar-senha">
          Esqueci minha senha
        </Link>
        <Link className="underline underline-offset-4" href="/">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
