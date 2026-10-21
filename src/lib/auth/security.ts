import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const RECOVERY_COOKIE = "lp-recovery";
export const RECOVERY_TTL = 600;

export function safeNext(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 1000 ||
    /[%\\\s?#]/.test(value)
  )
    return "/admin/dashboard";
  return /^\/admin(?:\/[a-zA-Z0-9_-]+)*\/?$/.test(value)
    ? value
    : "/admin/dashboard";
}
export function sameOrigin(origin: string | null, appUrl: string): boolean {
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}
export function limitHash(
  secret: string,
  scope: string,
  identity: string,
): string {
  return createHmac("sha256", secret)
    .update(JSON.stringify(["auth-limit-v1", scope, identity]))
    .digest("hex");
}
const grantSchema = z
  .object({
    userId: z.uuid(),
    sessionId: z.uuid(),
    issued: z.number().int(),
    expires: z.number().int(),
  })
  .strict();
type Grant = z.infer<typeof grantSchema>;
export function signRecovery(
  secret: string,
  userId: string,
  sessionId: string,
  now = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      sessionId,
      issued: now,
      expires: now + RECOVERY_TTL * 1000,
    }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(`recovery-v1:${payload}`).digest("base64url")}`;
}
export function readRecovery(
  secret: string,
  value: string | undefined,
  now = Date.now(),
): Grant | null {
  if (!value || value.length > 1000) return null;
  const parts = value.split(".");
  if (
    parts.length !== 2 ||
    !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))
  )
    return null;
  const signature = createHmac("sha256", secret)
    .update(`recovery-v1:${parts[0]}`)
    .digest();
  const supplied = Buffer.from(parts[1], "base64url");
  if (
    signature.length !== supplied.length ||
    !timingSafeEqual(signature, supplied)
  )
    return null;
  try {
    const grant = grantSchema.parse(
      JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")),
    );
    return grant.issued <= now &&
      grant.expires > now &&
      grant.expires - grant.issued === RECOVERY_TTL * 1000
      ? grant
      : null;
  } catch {
    return null;
  }
}
export function permissionForPath(path: string): string | undefined {
  const module = path.split("/")[2];
  return (
    {
      usuarios: "users.manage",
      configuracoes: "settings.manage",
      site: "settings.manage",
      frota: "vehicles.read",
      categorias: "categories.read",
      condutores: "drivers.read",
      unidades: "operations.read",
      vehicles: "vehicles.read",
      categories: "categories.read",
      customers: "customers.read",
      drivers: "drivers.read",
      branches: "operations.read",
      clientes: "customers.read",
      reservas: "reservations.read",
      reservations: "reservations.read",
      quotes: "reservations.request",
      availability: "reservations.read",
      planos: "pricing.read",
      precos: "pricing.read",
      adicionais: "pricing.read",
      "rate-plans": "pricing.read",
      prices: "pricing.read",
      services: "pricing.read",
      locacoes: "rentals.read",
      rentals: "rentals.read",
      financeiro: "finance.read",
      finance: "finance.read",
      manutencao: "maintenance.read",
      maintenance: "maintenance.read",
    } as Record<string, string>
  )[module];
}
export function canAccess(permissions: string[], permission?: string): boolean {
  return permission
    ? permissions.includes(permission)
    : permissions.includes("operations.read") ||
        permissions.includes("finance.read");
}
