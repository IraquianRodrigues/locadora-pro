import "server-only";
import {
  requireSupabaseEnvironment,
  getPublicEnvironment,
  ConfigurationError,
} from "@/config/env";
import { requireServiceRoleKey } from "@/config/server-env";

export function authConfig() {
  requireSupabaseEnvironment();
  requireServiceRoleKey();
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new ConfigurationError(
      "AUTH_SECRET deve ter pelo menos 32 caracteres.",
    );
  const appUrl = new URL(getPublicEnvironment().appUrl);
  if (
    appUrl.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname)
  ) {
    throw new ConfigurationError("Auth exige HTTPS fora do ambiente local.");
  }
  return {
    secret,
    appUrl: appUrl.origin,
    secure: appUrl.protocol === "https:",
  };
}
export function authConfigured(): boolean {
  try {
    authConfig();
    return true;
  } catch {
    return false;
  }
}
