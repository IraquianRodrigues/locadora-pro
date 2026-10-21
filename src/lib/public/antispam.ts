import "server-only";
import { z } from "zod";
import { authConfig } from "@/lib/auth/config";
import { RegistryError } from "@/lib/registry/service";
import { publicHash } from "./security";
export function turnstileConfig() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim(),
    secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!siteKey || !secret)
    throw new RegistryError(
      503,
      "PUBLIC_UNAVAILABLE",
      "Solicitações online temporariamente indisponíveis.",
    );
  return { siteKey, secret, hostname: new URL(authConfig().appUrl).hostname };
}
export async function verifyChallenge(
  token: string,
  action: "quote" | "reservation",
  key: string,
  visitor: string,
) {
  const config = turnstileConfig();
  if (!token)
    throw new RegistryError(
      400,
      "CHALLENGE_REQUIRED",
      "Conclua a verificação de segurança.",
    );
  const seed = Buffer.from(
    publicHash(
      config.secret,
      "captcha",
      JSON.stringify([visitor, action, key, token]),
    ).slice(0, 32),
    "hex",
  );
  seed[6] = (seed[6] & 15) | 64;
  seed[8] = (seed[8] & 63) | 128;
  const uuid = seed
    .toString("hex")
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
  let raw: unknown;
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: config.secret,
          response: token,
          idempotency_key: uuid,
        }),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error();
    raw = await response.json();
  } catch {
    throw new RegistryError(
      503,
      "CHALLENGE_UNAVAILABLE",
      "Verificação de segurança indisponível. Tente novamente.",
    );
  }
  const result = z
    .object({
      success: z.boolean(),
      hostname: z.string().optional(),
      action: z.string().optional(),
      challenge_ts: z.string().optional(),
    })
    .safeParse(raw);
  const timestamp = result.success
    ? Date.parse(result.data.challenge_ts ?? "")
    : NaN;
  if (
    !result.success ||
    !result.data.success ||
    result.data.hostname !== config.hostname ||
    result.data.action !== action ||
    !Number.isFinite(timestamp) ||
    timestamp > Date.now() + 30000 ||
    Date.now() - timestamp > 300000
  )
    throw new RegistryError(
      400,
      "CHALLENGE_INVALID",
      "Refaça a verificação de segurança.",
    );
}
