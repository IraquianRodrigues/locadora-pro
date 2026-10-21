import { NextResponse } from "next/server";
import { apiFailure } from "@/lib/registry/api";
import { RegistryError } from "@/lib/registry/service";
import { z } from "zod";
export const publicHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
export function publicFailure(error: unknown) {
  if (error instanceof z.ZodError) {
    const key = String(error.issues[0]?.path.at(-1) ?? "");
    const labels: Record<string, string> = {
      tax_document: "CPF/CNPJ e tipo de pessoa",
      email: "e-mail",
      phone: "telefone com DDD",
      postal_code: "CEP",
      state: "UF",
      name: "nome",
      start_at: "data e hora da retirada",
      end_at: "data e hora da devolução",
      pickup_address: "endereço de entrega",
      return_address: "endereço de coleta",
      accepted: "aceite das condições",
      birth_date: "data de nascimento",
      category_id: "categoria ou veículo",
      quantity: "quantidade de adicionais",
    };
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: labels[key]
            ? `Confira ${labels[key]} e tente novamente.`
            : "Confira os dados informados e tente novamente.",
        },
      },
      { status: 400, headers: publicHeaders },
    );
  }
  if (error instanceof RegistryError && error.status === 409)
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message:
            "Não foi possível concluir. Confira a cotação, atualize os dados ou procure o atendimento.",
        },
      },
      { status: 409, headers: publicHeaders },
    );
  const response = apiFailure(error);
  if (error instanceof RegistryError && error.status === 429)
    response.headers.set("Retry-After", "900");
  return response;
}
