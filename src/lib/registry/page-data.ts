import "server-only";
import { registry } from "./config";
import { lookupOptions } from "./service";
import type { Resource } from "./schema";
export async function formOptions(resource: Resource, permissions: string[]) {
  const lookups = [
    ...new Set(
      registry[resource].fields.flatMap((f) => (f.lookup ? [f.lookup] : [])),
    ),
  ];
  return Object.fromEntries(
    await Promise.all(
      lookups.map(async (lookup) => [
        lookup,
        permissions.includes(registry[lookup].read)
          ? await lookupOptions(lookup)
          : [],
      ]),
    ),
  );
}
