"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodFormResolver } from "@/lib/forms/resolver";
import { Button } from "@/components/ui/button";
import {
  emailSchema,
  loginSchema,
  passwordSchema,
  type AuthResult,
} from "@/lib/auth/schema";
import {
  loginAction,
  requestRecoveryAction,
  updatePasswordAction,
} from "@/lib/auth/actions";

type Values = { email?: string; password?: string; confirmation?: string };
export function AuthForm({
  mode,
  enabled,
  next,
}: {
  mode: "login" | "recovery" | "password";
  enabled: boolean;
  next?: string;
}) {
  const schema =
    mode === "login"
      ? loginSchema
      : mode === "recovery"
        ? emailSchema
        : passwordSchema;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodFormResolver<Values>(schema) });
  const [result, setResult] = useState<AuthResult>();
  const [visible, setVisible] = useState(false);
  async function submit(values: Values) {
    setResult(undefined);
    try {
      setResult(
        await (mode === "login"
          ? loginAction(values, next)
          : mode === "recovery"
            ? requestRecoveryAction(values)
            : updatePasswordAction(values)),
      );
    } catch {
      setResult({
        ok: false,
        message: "Não foi possível concluir. Tente novamente.",
      });
    }
  }
  const fields =
    mode === "recovery"
      ? (["email"] as const)
      : mode === "login"
        ? (["email", "password"] as const)
        : (["password", "confirmation"] as const);
  return (
    <form onSubmit={handleSubmit(submit)} className="mt-8 space-y-5" noValidate>
      {!enabled && (
        <p role="status" className="auth-notice">
          Acesso ainda indisponível. A configuração de autenticação está
          pendente.
        </p>
      )}
      {fields.map((field) => (
        <div key={field}>
          <label htmlFor={field} className="mb-2 block text-sm font-semibold">
            {field === "email"
              ? "E-mail"
              : field === "confirmation"
                ? "Confirmar senha"
                : mode === "password"
                  ? "Nova senha"
                  : "Senha"}
          </label>
          <div className="auth-input-wrap">
            <input
              id={field}
              type={field === "email" ? "email" : visible ? "text" : "password"}
              {...register(field)}
              autoComplete={
                field === "email"
                  ? "username"
                  : mode === "password"
                    ? "new-password"
                    : "current-password"
              }
              maxLength={field === "email" ? 254 : 128}
              disabled={!enabled || isSubmitting}
              aria-invalid={!!errors[field]}
              aria-describedby={
                errors[field]
                  ? `${field}-error`
                  : field === "password" && mode === "password"
                    ? "password-help"
                    : undefined
              }
              className="min-h-12 w-full rounded-lg border border-input bg-background px-3 pr-12 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            />
            {field !== "email" && (
              <button
                type="button"
                className="auth-password-toggle"
                aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={visible}
                disabled={!enabled || isSubmitting}
                onClick={() => setVisible((v) => !v)}
              >
                {visible ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            )}
          </div>
          {errors[field] && (
            <p
              id={`${field}-error`}
              role="alert"
              className="mt-2 text-sm text-red-700"
            >
              {errors[field]?.message}
            </p>
          )}
        </div>
      ))}
      {mode === "password" && (
        <p id="password-help" className="text-sm text-muted-foreground">
          Use de 12 a 128 caracteres, com maiúscula, minúscula, número e
          símbolo.
        </p>
      )}
      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className="rounded-lg border border-border p-4 text-sm"
        >
          {result.message}
        </p>
      )}
      <Button
        type="submit"
        disabled={!enabled || isSubmitting}
        className="w-full"
      >
        {isSubmitting
          ? "Aguarde…"
          : mode === "login"
            ? "Entrar"
            : mode === "recovery"
              ? "Enviar instruções"
              : "Salvar nova senha"}
      </Button>
    </form>
  );
}
