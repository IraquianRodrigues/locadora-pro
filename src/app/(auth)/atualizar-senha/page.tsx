import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { authConfig } from "@/lib/auth/config";
import { requirePageStaff } from "@/lib/auth/session";
import { readRecovery, RECOVERY_COOKIE } from "@/lib/auth/security";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export default async function PasswordPage() {
  const { staff } = await requirePageStaff();
  const grant = readRecovery(
    authConfig().secret,
    (await cookies()).get(RECOVERY_COOKIE)?.value,
  );
  if (
    !grant ||
    grant.userId !== staff.id ||
    grant.sessionId !== staff.sessionId
  )
    redirect("/recuperar-senha?link=invalido");
  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-bold tracking-tight">Definir nova senha</h1>
      <p className="mt-3 text-muted-foreground">
        Após salvar, você precisará entrar novamente em seus dispositivos.
      </p>
      <AuthForm mode="password" enabled />
      <form action={logoutAction} className="mt-5">
        <Button variant="ghost" type="submit">
          Cancelar e sair
        </Button>
      </form>
    </div>
  );
}
