import { parseTimezone, privilegedPublicKey } from "./env";
type Environment = Record<string, string | undefined>;
export function deploymentChecks(env: Environment) {
  const failures: string[] = [];
  for (const name of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
    try {
      const url = new URL(env[name] ?? "");
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/" ||
        ["localhost", "127.0.0.1", "[::1]", "example.com"].includes(
          url.hostname,
        )
      )
        throw new Error();
    } catch {
      failures.push(`${name}:HTTPS_ORIGIN_REQUIRED`);
    }
  }
  const publicKey = (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  const privileged = privilegedPublicKey(publicKey);
  if (
    !publicKey ||
    privileged ||
    publicKey === env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  )
    failures.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:PUBLIC_KEY_REQUIRED");
  for (const name of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
  ])
    if (!env[name]?.trim()) failures.push(`${name}:REQUIRED`);
  const secrets = [
    "AUTH_SECRET",
    "RENTAL_JOBS_SECRET",
    "OPERATIONS_JOBS_SECRET",
    "READINESS_SECRET",
  ];
  for (const name of secrets)
    if ((env[name]?.trim().length ?? 0) < 32) failures.push(`${name}:MIN_32`);
  const present = secrets.map((name) => env[name]?.trim()).filter(Boolean);
  if (new Set(present).size !== present.length)
    failures.push("SECRETS:MUST_BE_DISTINCT");
  try {
    parseTimezone(env.APP_TIMEZONE);
  } catch {
    failures.push("APP_TIMEZONE:INVALID");
  }
  if (
    env.NOTIFICATION_EMAIL_PROVIDER &&
    (env.NOTIFICATION_EMAIL_PROVIDER !== "resend" ||
      !env.RESEND_API_KEY?.trim() ||
      !env.NOTIFICATION_FROM ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.NOTIFICATION_FROM))
  )
    failures.push("EMAIL:INCOMPLETE_CONFIGURATION");
  return failures;
}
