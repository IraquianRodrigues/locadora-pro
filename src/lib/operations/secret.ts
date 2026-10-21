import { timingSafeEqual } from "node:crypto";
export function internalAuthorization(
  secret: string | undefined,
  authorization: string | null,
) {
  if (!secret || secret.length < 32) return 503;
  const actual = Buffer.from(authorization ?? ""),
    expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected)
    ? 200
    : 401;
}
