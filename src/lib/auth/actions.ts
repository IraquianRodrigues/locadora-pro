"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSupabaseEnvironment } from "@/config/env";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authConfig } from "./config";
import { consumeLimit } from "./limits";
import {
  emailSchema,
  loginSchema,
  passwordSchema,
  type AuthResult,
} from "./schema";
import { verifiedStaff } from "./session";
import {
  readRecovery,
  RECOVERY_COOKIE,
  RECOVERY_TTL,
  safeNext,
  sameOrigin,
  signRecovery,
} from "./security";

const unavailable: AuthResult = {
  ok: false,
  message: "Não foi possível concluir. Tente novamente em alguns minutos.",
};
const invalidLogin: AuthResult = {
  ok: false,
  message:
    "Não foi possível entrar. Confira os dados e a liberação do seu acesso.",
};
const recoveryResponse: AuthResult = {
  ok: true,
  message:
    "Se o endereço estiver cadastrado, você receberá as instruções. Confira também a pasta de spam.",
};

async function checkOrigin() {
  const config = authConfig();
  if (!sameOrigin((await headers()).get("origin"), config.appUrl))
    throw new Error("INVALID_ORIGIN");
  return config;
}

async function rejectSession(client: SupabaseClient) {
  try {
    await client.auth.signOut({ scope: "local" });
  } finally {
    // Uma falha remota de logout não pode deixar no navegador o novo login recusado.
    const prefix = `sb-${new URL(requireSupabaseEnvironment().url).hostname.split(".")[0]}-auth-token`;
    const store = await cookies();
    for (const { name } of store.getAll())
      if (
        name === prefix ||
        name.startsWith(`${prefix}.`) ||
        name === `${prefix}-code-verifier`
      )
        store.delete(name);
    store.delete(RECOVERY_COOKIE);
  }
}

export async function loginAction(
  input: unknown,
  next?: string,
): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return invalidLogin;
  try {
    await checkOrigin();
    if (!(await consumeLimit("login", parsed.data.email, 10)))
      return invalidLogin;
    const client = await createClient(true);
    const result = await client.auth.signInWithPassword(parsed.data);
    if (result.error) return invalidLogin;
    try {
      await verifiedStaff(client);
      const audit = await client.rpc("record_auth_event", {
        event_code: "LOGIN",
      });
      if (audit.error) throw new Error("AUTH_AUDIT_UNAVAILABLE");
    } catch {
      await rejectSession(client);
      return invalidLogin;
    }
    (await cookies()).delete(RECOVERY_COOKIE);
  } catch {
    return unavailable;
  }
  redirect(safeNext(next));
}

export async function requestRecoveryAction(
  input: unknown,
): Promise<AuthResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return recoveryResponse;
  try {
    const config = await checkOrigin();
    if (!(await consumeLimit("recovery", parsed.data.email, 3)))
      return recoveryResponse;
    const client = await createClient(true);
    // Erros de entrega/conta/limite têm a mesma resposta. Não consultamos existência de e-mail.
    await client.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${config.appUrl}/auth/confirm`,
    });
  } catch {
    return recoveryResponse;
  }
  return recoveryResponse;
}

export async function confirmRecoveryAction(form: FormData): Promise<void> {
  let success = false;
  try {
    const config = await checkOrigin();
    const token = z
      .string()
      .regex(/^[a-fA-F0-9]{32,128}$/)
      .parse(form.get("token_hash"));
    if (!(await consumeLimit("recovery-confirm", token, 5)))
      throw new Error("LIMITED");
    const client = await createClient(true);
    const { error } = await client.auth.verifyOtp({
      token_hash: token,
      type: "recovery",
    });
    if (error) throw new Error("INVALID_RECOVERY");
    try {
      const staff = await verifiedStaff(client);
      const audit = await client.rpc("record_auth_event", {
        event_code: "PASSWORD_RECOVERY",
      });
      if (audit.error) throw new Error("AUTH_AUDIT_UNAVAILABLE");
      (await cookies()).set(
        RECOVERY_COOKIE,
        signRecovery(config.secret, staff.id, staff.sessionId),
        {
          httpOnly: true,
          secure: config.secure,
          sameSite: "lax",
          path: "/",
          maxAge: RECOVERY_TTL,
        },
      );
      success = true;
    } catch {
      await rejectSession(client);
    }
  } catch {
    /* Sem token/identidade no log nem na URL de erro. */
  }
  redirect(success ? "/atualizar-senha" : "/recuperar-senha?link=invalido");
}

export async function updatePasswordAction(
  input: unknown,
): Promise<AuthResult> {
  const partial: AuthResult = {
    ok: false,
    message:
      "Senha atualizada. Não foi possível concluir o encerramento de sessões ou seu registro. Encerre a sessão e contate o administrador.",
  };
  let passwordUpdated = false;
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Confira os requisitos e a confirmação da senha.",
    };
  try {
    const config = await checkOrigin();
    const client = await createClient(true);
    const staff = await verifiedStaff(client);
    const grant = readRecovery(
      config.secret,
      (await cookies()).get(RECOVERY_COOKIE)?.value,
    );
    if (
      !grant ||
      grant.userId !== staff.id ||
      grant.sessionId !== staff.sessionId
    )
      return {
        ok: false,
        message: "O link expirou. Solicite uma nova recuperação.",
      };
    if (!(await consumeLimit("password-update", staff.id, 5)))
      return unavailable;
    const { error } = await client.auth.updateUser({
      password: parsed.data.password,
    });
    if (error)
      return {
        ok: false,
        message:
          "Não foi possível atualizar. Use uma senha diferente que atenda aos requisitos.",
      };
    passwordUpdated = true;
    // Consumir a autorização antes de qualquer outra operação.
    (await cookies()).delete(RECOVERY_COOKIE);
    let auditFailed = false;
    try {
      const audit = await client.rpc("record_auth_event", {
        event_code: "PASSWORD_UPDATED",
      });
      auditFailed = !!audit.error;
    } catch {
      auditFailed = true;
    }
    const logout = await client.auth.signOut({ scope: "global" });
    if (logout.error || auditFailed) return partial;
  } catch {
    return passwordUpdated ? partial : unavailable;
  }
  redirect("/login?senha=atualizada");
}

export async function logoutAction(): Promise<void> {
  let failed: boolean;
  try {
    await checkOrigin();
    const client = await createClient(true);
    // Falha de auditoria nunca impede o encerramento da sessão.
    try {
      await client.rpc("record_auth_event", { event_code: "LOGOUT" });
    } catch {
      /* Encerrar mesmo se o registro falhar. */
    }
    const { error } = await client.auth.signOut({ scope: "local" });
    failed = !!error;
    if (!failed) (await cookies()).delete(RECOVERY_COOKIE);
  } catch {
    failed = true;
  }
  redirect(failed ? "/login?saida=falhou" : "/login?saida=ok");
}

export async function setStaffAccessAction(form: FormData): Promise<void> {
  let success = false;
  try {
    await checkOrigin();
    const client = await createClient(true);
    const staff = await verifiedStaff(client);
    if (!staff.permissions.includes("users.manage"))
      throw new Error("FORBIDDEN");
    const input = z
      .object({
        user_id: z.uuid(),
        active: z.boolean(),
        role_code: z.enum(["ADMIN", "MANAGER", "ATTENDANT", "FINANCE"]),
      })
      .parse({
        user_id: form.get("user_id"),
        active: form.get("active") === "on",
        role_code: form.get("role_code"),
      });
    const result = await client.rpc("set_staff_access", input);
    success = !result.error;
  } catch {
    /* Negação e falha transacional não expõem SQL/identidade. */
  }
  redirect(`/admin/usuarios?resultado=${success ? "ok" : "erro"}`);
}
