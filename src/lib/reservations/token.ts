import { createHash, createHmac } from "node:crypto";
export function lookupToken(
  secret: string,
  actor: string,
  quote: string,
  key: string,
) {
  return createHmac("sha256", secret)
    .update(JSON.stringify(["reservation-lookup-v1", actor, quote, key]))
    .digest("base64url");
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
