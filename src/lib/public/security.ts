import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
export const VISITOR_COOKIE = "lp-public-visitor";
export function signVisitor(
  secret: string,
  id: string = randomUUID(),
  now = Date.now(),
) {
  const data = Buffer.from(
    JSON.stringify({ id, issued: now, expires: now + 86400000 }),
  ).toString("base64url");
  return `${data}.${createHmac("sha256", secret).update(`public-visitor-v1:${data}`).digest("base64url")}`;
}
export function readVisitor(
  secret: string,
  value: string | undefined,
  now = Date.now(),
): { id: string; issued: number } | null {
  if (!value || value.length > 1000) return null;
  const [data, sig, ...extra] = value.split(".");
  if (!data || !sig || extra.length) return null;
  const expected = createHmac("sha256", secret)
      .update(`public-visitor-v1:${data}`)
      .digest(),
    given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return null;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString());
    return /^[a-f0-9-]{36}$/.test(p.id) &&
      Number.isSafeInteger(p.issued) &&
      p.issued <= now &&
      p.expires > now &&
      p.expires - p.issued === 86400000
      ? { id: p.id, issued: p.issued }
      : null;
  } catch {
    return null;
  }
}
export function publicHash(secret: string, scope: string, value: string) {
  return createHmac("sha256", secret)
    .update(JSON.stringify(["public-booking-v1", scope, value]))
    .digest("hex");
}
