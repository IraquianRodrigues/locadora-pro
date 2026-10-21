"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertMutationOrigin } from "@/lib/registry/origin";
import { RegistryError } from "@/lib/registry/service";
import {
  createQuote,
  availability,
  requestReservation,
  decideReservation,
  expireReservations,
} from "./service";
function message(error: unknown) {
  if (error instanceof RegistryError) return error.message;
  if (error instanceof z.ZodError)
    return error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(" · ")
      .slice(0, 1500);
  return "Operação indisponível. Confira sua sessão e tente novamente.";
}
export async function quoteAction(input: unknown, key: string) {
  try {
    await assertMutationOrigin();
    const quote = await createQuote(input, key);
    const stock = await availability(input);
    return { ok: true as const, quote, stock };
  } catch (error) {
    return { ok: false as const, message: message(error) };
  }
}
export async function requestReservationAction(input: unknown) {
  try {
    await assertMutationOrigin();
    const result = await requestReservation(input);
    revalidatePath("/admin/reservas");
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, message: message(error) };
  }
}
export async function decisionAction(id: string, input: unknown) {
  try {
    await assertMutationOrigin();
    const result = await decideReservation(id, input);
    revalidatePath("/admin/reservas");
    revalidatePath(`/admin/reservas/${id}`);
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, message: message(error) };
  }
}
export async function expiryAction() {
  try {
    await assertMutationOrigin();
    const count = await expireReservations();
    revalidatePath("/admin/reservas");
    return { ok: true as const, count };
  } catch (error) {
    return { ok: false as const, message: message(error) };
  }
}
