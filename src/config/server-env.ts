import "server-only";
import {
  ConfigurationError,
  getPublicEnvironment,
  parseTimezone,
} from "@/config/env";

export function getServerEnvironment() {
  return {
    ...getPublicEnvironment(),
    timezone: parseTimezone(process.env.APP_TIMEZONE),
  };
}

export function requireServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key)
    throw new ConfigurationError(
      "Chave de serviço do Supabase não configurada.",
    );
  return key;
}
