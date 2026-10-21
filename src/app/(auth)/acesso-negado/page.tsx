import Link from "next/link";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export default function AccessDenied() {
  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-bold">Acesso não autorizado</h1>
      <p className="mt-4 text-muted-foreground">
        Seu perfil não tem permissão para esta área. Solicite a liberação ao
        administrador.
      </p>
      <Link href="/admin/dashboard" className="mt-6 inline-block underline">
        Voltar ao painel
      </Link>
      <form action={logoutAction} className="mt-5">
        <Button variant="outline" type="submit">
          Sair da conta
        </Button>
      </form>
    </div>
  );
}
