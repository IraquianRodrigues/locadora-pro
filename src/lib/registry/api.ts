import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AccessError } from "@/lib/auth/session";
import { RegistryError } from "./service";
import type { Resource } from "./schema";
export const apiResources: Record<string, Resource> = {
  categories: "categorias",
  vehicles: "frota",
  customers: "clientes",
  drivers: "condutores",
  branches: "unidades",
  "rate-plans": "planos",
  prices: "precos",
  services: "adicionais",
};
export function apiResource(key: string) {
  const value = Object.hasOwn(apiResources, key)
    ? apiResources[key]
    : undefined;
  if (!value) throw new RegistryError(404, "NOT_FOUND", "Rota não encontrada.");
  return value;
}
export function apiFailure(error: unknown) {
  const status =
    error instanceof RegistryError || error instanceof AccessError
      ? error.status
      : error instanceof z.ZodError
        ? 400
        : 503;
  const code =
    error instanceof RegistryError
      ? error.code
      : status === 400
        ? "INVALID_REQUEST"
        : status === 401
          ? "UNAUTHORIZED"
          : status === 403
            ? "FORBIDDEN"
            : "SERVICE_UNAVAILABLE";
  const message =
    error instanceof RegistryError
      ? error.message
      : status === 400
        ? "Dados inválidos."
        : status === 401 || status === 403
          ? "Acesso não autorizado."
          : "Serviço temporariamente indisponível.";
  return NextResponse.json(
    { error: { code, message, requestId: randomUUID() } },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function readJson(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader)
    throw new RegistryError(400, "INVALID_REQUEST", "Corpo JSON obrigatório.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 65536) {
      await reader.cancel();
      throw new RegistryError(413, "INVALID_REQUEST", "Corpo excede 64 KiB.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new RegistryError(400, "INVALID_REQUEST", "JSON inválido.");
  }
}
