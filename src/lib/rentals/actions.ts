"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertMutationOrigin } from "@/lib/registry/origin";
import { requireStaff } from "@/lib/auth/session";
import { RegistryError } from "@/lib/registry/service";
import {
  createRental,
  commandRental,
  extendRental,
  setupRentals,
  rentalFile,
} from "./service";
import { uploadInspectionPhoto } from "./files";
import { processRentalJobs } from "./worker";
function message(e: unknown) {
  return e instanceof RegistryError
    ? e.message
    : e instanceof z.ZodError
      ? e.issues
          .map((i) => i.message)
          .join(" · ")
          .slice(0, 1000)
      : "Operação indisponível. Confira sua sessão e os pré-requisitos.";
}
export async function rentalAction(
  kind: "create" | "command" | "extend" | "setup",
  input: unknown,
  key: string,
) {
  try {
    await assertMutationOrigin();
    const result =
      kind === "create"
        ? await createRental(input, key)
        : kind === "command"
          ? await commandRental(input, key)
          : kind === "extend"
            ? await extendRental(input, key)
            : await setupRentals(input, key);
    revalidatePath("/admin/locacoes", "layout");
    revalidatePath("/admin/reservas", "layout");
    return { ok: true as const, ...result };
  } catch (e) {
    return { ok: false as const, message: message(e) };
  }
}
export async function rentalJobsAction() {
  try {
    await assertMutationOrigin();
    await requireStaff("contracts.generate");
    const result = await processRentalJobs();
    revalidatePath("/admin/locacoes", "layout");
    return { ok: true as const, ...result };
  } catch (e) {
    return { ok: false as const, message: message(e) };
  }
}
export async function inspectionPhotoAction(form: FormData) {
  try {
    await assertMutationOrigin();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new RegistryError(400, "INVALID_FILE", "Selecione uma imagem.");
    const result = await uploadInspectionPhoto(
      String(form.get("inspection_id")),
      String(form.get("item_id")),
      file,
    );
    revalidatePath("/admin/locacoes", "layout");
    return { ok: true as const, ...result };
  } catch (e) {
    return { ok: false as const, message: message(e) };
  }
}
export async function rentalFileAction(id: string, kind: "contract" | "photo") {
  try {
    await assertMutationOrigin();
    z.enum(["contract", "photo"]).parse(kind);
    return { ok: true as const, url: await rentalFile(id, kind) };
  } catch (e) {
    return { ok: false as const, message: message(e) };
  }
}
