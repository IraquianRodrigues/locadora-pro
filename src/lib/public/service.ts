import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { authConfig } from "@/lib/auth/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeLimit } from "@/lib/auth/limits";
import { databaseError, RegistryError } from "@/lib/registry/service";
import { catalogSchema } from "@/lib/reservations/schema";
import { calculateQuote } from "@/lib/pricing/engine";
import { lookupToken, tokenHash } from "@/lib/reservations/token";
import {
  publicQuoteSchema,
  publicRequestSchema,
  publicQuoteView,
} from "./schema";
import { VISITOR_COOKIE, readVisitor, publicHash } from "./security";
import { turnstileConfig, verifyChallenge } from "./antispam";
export async function publicAdminRPC(
  name: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await createAdminClient().rpc(name, args);
  if (error) databaseError(error);
  return data as unknown;
}
export async function publicLimit(
  scope: string,
  identity: string,
  max: number,
) {
  if (!(await consumeLimit(`public-${scope}`, identity, max)))
    throw new RegistryError(
      429,
      "RATE_LIMITED",
      "Aguarde alguns minutos antes de tentar novamente.",
    );
}
async function visitor() {
  turnstileConfig();
  const { secret } = authConfig(),
    p = readVisitor(secret, (await cookies()).get(VISITOR_COOKIE)?.value);
  if (!p)
    throw new RegistryError(
      403,
      "VISITOR_REQUIRED",
      "Reabra o formulário para iniciar uma sessão de atendimento.",
    );
  return {
    hash: publicHash(secret, "visitor", p.id),
    age: Date.now() - p.issued,
  };
}
function spam(website: string, age: number) {
  if (website || age < 2000)
    throw new RegistryError(
      400,
      "INVALID_REQUEST",
      "Não foi possível validar a solicitação.",
    );
}
export async function quotePublic(raw: unknown) {
  const body = publicQuoteSchema.parse(raw),
    v = await visitor();
  await publicLimit("quote", v.hash, 10);
  spam(body.website, v.age);
  const args = {
    visitor_hash: v.hash,
    operation: "QUOTE",
    idempotency_key: body.idempotency_key,
    payload: body.input,
  };
  const prior = await publicAdminRPC("find_public_operation", args);
  let id: string;
  if (prior) id = z.object({ id: z.uuid() }).parse(prior).id;
  else {
    await verifyChallenge(body.captcha, "quote", body.idempotency_key, v.hash);
    const catalog = catalogSchema.parse(
      await publicAdminRPC("public_pricing_context", { input: body.input }),
    );
    let calculation: ReturnType<typeof calculateQuote>;
    try {
      calculation = calculateQuote(body.input, catalog, {
        canDiscount: false,
        roles: [],
      });
    } catch (error) {
      throw new RegistryError(
        400,
        "INVALID_QUOTE",
        error instanceof Error
          ? error.message
          : "Não foi possível calcular a cotação.",
      );
    }
    const result = await publicAdminRPC("persist_public_quote", {
      visitor_hash: v.hash,
      input: body.input,
      expected_fingerprint: catalog.fingerprint,
      calculation,
      idempotency_key: body.idempotency_key,
    });
    id = z.object({ id: z.uuid() }).parse(result).id;
  }
  const view = publicQuoteView.parse(
    await publicAdminRPC("public_quote_owned", {
      visitor_hash: v.hash,
      quote_id: id,
    }),
  );
  return {
    ...view,
    available: z
      .number()
      .int()
      .min(0)
      .parse(
        await publicAdminRPC("public_quote_stock", {
          visitor_hash: v.hash,
          quote_id: id,
        }),
      ),
  };
}
export async function requestPublic(raw: unknown) {
  const body = publicRequestSchema.parse(raw),
    v = await visitor();
  await publicLimit("request", v.hash, 5);
  spam(body.website, v.age);
  const payload = {
    quote_id: body.quote_id,
    customer: body.customer,
    terms_version: body.terms_version,
  };
  const token = lookupToken(
    authConfig().secret,
    `public:${v.hash}`,
    body.quote_id,
    body.idempotency_key,
  );
  const previous = await publicAdminRPC("find_public_operation", {
    visitor_hash: v.hash,
    operation: "REQUEST",
    idempotency_key: body.idempotency_key,
    payload,
  });
  if (previous)
    return {
      ...z
        .object({ id: z.uuid(), status: z.literal("REQUESTED") })
        .parse(previous),
      lookup_token: token,
    };
  await publicLimit(
    "document",
    publicHash(authConfig().secret, "document", body.customer.tax_document),
    3,
  );
  await publicLimit(
    "email",
    publicHash(authConfig().secret, "email", body.customer.email),
    3,
  );
  await verifyChallenge(
    body.captcha,
    "reservation",
    body.idempotency_key,
    v.hash,
  );
  const result = await publicAdminRPC("request_public_reservation", {
    visitor_hash: v.hash,
    quote_id: body.quote_id,
    customer_data: body.customer,
    terms_version: body.terms_version,
    token_hash: tokenHash(token),
    idempotency_key: body.idempotency_key,
  });
  return {
    ...z.object({ id: z.uuid(), status: z.literal("REQUESTED") }).parse(result),
    lookup_token: token,
  };
}
