import "server-only";
import { headers } from "next/headers";
import { authConfig } from "@/lib/auth/config";
import { sameOrigin } from "@/lib/auth/security";
import { RegistryError } from "./service";
export async function assertMutationOrigin() {
  if (!sameOrigin((await headers()).get("origin"), authConfig().appUrl))
    throw new RegistryError(403, "FORBIDDEN", "Origem não autorizada.");
}
