import type { FieldValues, FieldErrors, Resolver } from "react-hook-form";
import type { z } from "zod";
export function zodFormResolver<T extends FieldValues>(
  schema: z.ZodType,
): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data as T, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const field = String(issue.path[0]);
      if (!errors[field])
        errors[field] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as FieldErrors<T> };
  };
}
