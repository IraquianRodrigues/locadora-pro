import Link from "next/link";
import { Button } from "@/components/ui/button";
import { confirmRecoveryAction } from "@/lib/auth/actions";
import { authConfigured } from "@/lib/auth/config";
export const dynamic = "force-dynamic";
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const valid =
    params.type === "recovery" &&
    typeof params.token_hash === "string" &&
    /^[a-fA-F0-9]{32,128}$/.test(params.token_hash);
  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-bold tracking-tight">
        Confirmar recuperação
      </h1>
      {valid ? (
        <>
          <p className="mt-4 text-muted-foreground">
            Continue para validar seu link e escolher uma nova senha.
          </p>
          <form action={confirmRecoveryAction} className="mt-8">
            <input type="hidden" name="token_hash" value={params.token_hash} />
            <Button type="submit" disabled={!authConfigured()}>
              Continuar recuperação
            </Button>
          </form>
        </>
      ) : (
        <p role="alert" className="mt-4">
          Link inválido. Solicite uma nova recuperação.
        </p>
      )}
      <Link
        href="/recuperar-senha"
        className="mt-6 block text-sm underline underline-offset-4"
      >
        Solicitar outro link
      </Link>
    </div>
  );
}
