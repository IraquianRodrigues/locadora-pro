import { z } from "zod";

export const emailSchema = z.object({
  email: z.email("Informe um e-mail válido.").max(254).trim().toLowerCase(),
});
export const loginSchema = emailSchema.extend({
  password: z
    .string()
    .min(1, "Informe sua senha.")
    .max(128, "Senha muito longa."),
});
export const passwordSchema = z
  .object({
    password: z
      .string()
      .min(12, "Use pelo menos 12 caracteres.")
      .max(128, "Use até 128 caracteres.")
      .regex(/[a-z]/, "Inclua uma letra minúscula.")
      .regex(/[A-Z]/, "Inclua uma letra maiúscula.")
      .regex(/[0-9]/, "Inclua um número.")
      .regex(/[^a-zA-Z0-9]/, "Inclua um símbolo."),
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    path: ["confirmation"],
    message: "As senhas precisam ser iguais.",
  });
export const staffSchema = z.object({
  id: z.uuid(),
  displayName: z.string().min(1).max(120),
  sessionId: z.uuid(),
  roles: z.array(z.enum(["ADMIN", "MANAGER", "ATTENDANT", "FINANCE"])).min(1),
  permissions: z.array(z.string().min(1)).min(1),
});
export type Staff = z.infer<typeof staffSchema>;
export type AuthResult = { ok: boolean; message: string };
