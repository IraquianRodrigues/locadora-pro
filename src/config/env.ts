import { z } from "zod";

type Environment = Record<string, string | undefined>;
const optionalValue = (value: string | undefined) => value?.trim() || undefined;
export function privilegedPublicKey(raw: string) {
  const key = raw.trim();
  if (key.startsWith("sb_secret_")) return true;
  try {
    const payload = key.split(".")[1];
    if (!payload) return false;
    const role = JSON.parse(
      atob(payload.replaceAll("-", "+").replaceAll("_", "/")),
    ).role;
    return role === "service_role" || role === "authenticated";
  } catch {
    return false;
  }
}
const httpUrl = z.string().refine((value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
});

const publicSchema = z
  .object({
    appUrl: httpUrl.default("http://localhost:3000"),
    supabaseUrl: httpUrl.optional(),
    supabaseKey: z
      .string()
      .min(1)
      .refine(
        (v) => !privilegedPublicKey(v),
        "Use somente chave publicável ou anon, nunca chave de serviço.",
      )
      .optional(),
  })
  .superRefine((value, context) => {
    if (Boolean(value.supabaseUrl) !== Boolean(value.supabaseKey)) {
      context.addIssue({
        code: "custom",
        message: "Configure URL e chave publicável do Supabase juntas.",
      });
    }
  });

export class ConfigurationError extends Error {
  constructor(
    message = "Configuração do ambiente inválida. Consulte .env.example.",
  ) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function parsePublicEnvironment(source: Environment) {
  const result = publicSchema.safeParse({
    appUrl: optionalValue(source.NEXT_PUBLIC_APP_URL),
    supabaseUrl: optionalValue(source.NEXT_PUBLIC_SUPABASE_URL),
    supabaseKey: optionalValue(source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  });

  if (!result.success) throw new ConfigurationError();
  return result.data;
}

export function getPublicEnvironment() {
  // Acesso explícito permite a substituição estática de NEXT_PUBLIC pelo Next.js.
  return parsePublicEnvironment({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function requireSupabaseEnvironment() {
  const config = getPublicEnvironment();
  if (!config.supabaseUrl || !config.supabaseKey) {
    throw new ConfigurationError(
      "Supabase não configurado. Consulte .env.example.",
    );
  }
  return { url: config.supabaseUrl, key: config.supabaseKey };
}

export function parseTimezone(value: string | undefined) {
  const timezone = optionalValue(value) ?? "America/Fortaleza";
  try {
    if (/^[+-]/.test(timezone)) throw new Error("Offset não é timezone IANA.");
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }).format();
    return timezone;
  } catch {
    throw new ConfigurationError(
      "APP_TIMEZONE deve ser um timezone IANA válido.",
    );
  }
}
