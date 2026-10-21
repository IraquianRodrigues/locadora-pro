"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertMutationOrigin } from "@/lib/registry/origin";
import { requireStaff } from "@/lib/auth/session";
import { RegistryError } from "@/lib/registry/service";
import { financeCommand, configureFinance } from "@/lib/finance/service";
import { maintenanceCommand } from "@/lib/maintenance/service";
import {
  setupNotifications,
  retryNotification,
  readNotification,
} from "@/lib/notifications/service";
import { processBusinessJobs } from "@/lib/notifications/worker";
export type BusinessDomain =
  | "finance"
  | "finance-setup"
  | "maintenance"
  | "notification-setup"
  | "notification-retry";
function message(e: unknown) {
  return e instanceof RegistryError
    ? e.message
    : e instanceof z.ZodError
      ? e.issues
          .map((i) => i.message)
          .join(" · ")
          .slice(0, 1200)
      : "Operação indisponível. Confira sua sessão e tente novamente.";
}
export async function businessMutation(
  domain: BusinessDomain,
  input: unknown,
  key: string,
) {
  try {
    await assertMutationOrigin();
    z.enum([
      "finance",
      "finance-setup",
      "maintenance",
      "notification-setup",
      "notification-retry",
    ]).parse(domain);
    const r =
      domain === "finance"
        ? await financeCommand(input, key)
        : domain === "finance-setup"
          ? await configureFinance(input, key)
          : domain === "maintenance"
            ? await maintenanceCommand(input, key)
            : domain === "notification-setup"
              ? await setupNotifications(input, key)
              : await retryNotification(input, key);
    revalidatePath("/admin", "layout");
    return { ok: true as const, ...r };
  } catch (e) {
    return { ok: false as const, message: message(e) };
  }
}
export async function readNotificationAction(id: string) {
  try {
    await assertMutationOrigin();
    await readNotification(id);
    revalidatePath("/admin/notificacoes");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: message(e) };
  }
}
export async function businessJobsAction() {
  try {
    await assertMutationOrigin();
    await requireStaff("settings.manage");
    const r = await processBusinessJobs();
    revalidatePath("/admin", "layout");
    return { ok: true as const, ...r };
  } catch (e) {
    return { ok: false as const, message: message(e) };
  }
}
