import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  canAccess,
  limitHash,
  permissionForPath,
  readRecovery,
  safeNext,
  sameOrigin,
  signRecovery,
} from "@/lib/auth/security";
import { loginSchema, passwordSchema, staffSchema } from "@/lib/auth/schema";

describe("limites de confiança Auth", () => {
  it("permite somente destinos internos do painel", () => {
    expect(safeNext("/admin/reservas")).toBe("/admin/reservas");
    for (const value of [
      "//evil.invalid",
      "https://evil.invalid",
      "/admin/../login",
      "/admin/%2f%2fevil",
      "/admin\\evil",
      "/admin?next=evil",
      "/administrator",
      ["/admin"],
      "/admin\n",
    ])
      expect(safeNext(value)).toBe("/admin/dashboard");
  });
  it("exige origem canônica exata", () => {
    expect(
      sameOrigin("https://locadora.example", "https://locadora.example"),
    ).toBe(true);
    for (const value of [
      null,
      "null",
      "https://evil.invalid",
      "https://locadora.example.evil.invalid",
      "http://locadora.example",
    ])
      expect(sameOrigin(value, "https://locadora.example")).toBe(false);
  });
  it("compara permissões e não aceita nome do cargo como permissão", () => {
    expect(canAccess(["ADMIN"], "users.manage")).toBe(false);
    expect(canAccess(["finance.read"])).toBe(true);
    expect(canAccess(["operations.read"], "finance.read")).toBe(false);
    expect(permissionForPath("/admin/usuarios")).toBe("users.manage");
  });
  it("separa hashes por propósito, identidade e segredo sem guardar PII", () => {
    const a = limitHash("a".repeat(32), "login", "user@example.invalid");
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).not.toBe(
      limitHash("a".repeat(32), "recovery", "user@example.invalid"),
    );
    expect(a).not.toBe(
      limitHash("b".repeat(32), "login", "user@example.invalid"),
    );
  });
  it("autorização de recuperação expira e rejeita alteração de conteúdo ou assinatura", () => {
    const secret = "s".repeat(32),
      user = randomUUID(),
      session = randomUUID(),
      now = 1000000;
    const signed = signRecovery(secret, user, session, now);
    expect(readRecovery(secret, signed, now + 1)).toMatchObject({
      userId: user,
      sessionId: session,
    });
    expect(readRecovery(secret, signed, now + 600000)).toBeNull();
    expect(readRecovery(secret, signed, now - 1)).toBeNull();
    expect(readRecovery("other", signed, now)).toBeNull();
    for (const value of [
      undefined,
      "forged",
      signed + ".x",
      `x${signed}`,
      signed.slice(0, -3),
      "a".repeat(1001),
    ])
      expect(readRecovery(secret, value, now)).toBeNull();
  });
  it("valida senha forte, confirmação e entrada limitada", () => {
    expect(
      passwordSchema.safeParse({
        password: "SenhaForte123!",
        confirmation: "SenhaForte123!",
      }).success,
    ).toBe(true);
    for (const value of [
      "curta",
      "somenteletrasminusculas",
      "MAIUSCULAS123!",
      "SemSimbolo1234",
      "SemNumeroMuito!",
      "a".repeat(129),
    ])
      expect(
        passwordSchema.safeParse({ password: value, confirmation: value })
          .success,
      ).toBe(false);
    expect(
      passwordSchema.safeParse({
        password: "SenhaForte123!",
        confirmation: "Diferente123!",
      }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({ email: "x@x.invalid", password: "a".repeat(129) })
        .success,
    ).toBe(false);
    expect(
      staffSchema.safeParse({
        id: randomUUID(),
        sessionId: randomUUID(),
        displayName: "Teste",
        roles: ["ADMIN"],
        permissions: [],
      }).success,
    ).toBe(false);
  });
});
