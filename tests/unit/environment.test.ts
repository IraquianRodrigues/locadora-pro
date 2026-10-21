import { describe, expect, it } from "vitest";
import {
  ConfigurationError,
  parsePublicEnvironment,
  parseTimezone,
} from "@/config/env";

describe("limites de configuração", () => {
  it("permite a fundação sem banco, sem fabricar credenciais", () => {
    expect(parsePublicEnvironment({})).toEqual({
      appUrl: "http://localhost:3000",
    });
  });

  it.each([
    { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
    { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test" },
    { NEXT_PUBLIC_APP_URL: "javascript:alert(1)" },
    { NEXT_PUBLIC_APP_URL: "ftp://example.org" },
    {
      NEXT_PUBLIC_SUPABASE_URL: "invalid",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test",
    },
  ])(
    "recusa configuração parcial ou inválida sem expor valores",
    (environment) => {
      expect(() => parsePublicEnvironment(environment)).toThrow(
        ConfigurationError,
      );
      expect(() => parsePublicEnvironment(environment)).toThrow(
        "Configuração do ambiente inválida",
      );
    },
  );

  it("aceita URL e chave públicas, sem retornar chave de serviço", () => {
    const environment = {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test",
      SUPABASE_SERVICE_ROLE_KEY: "private-test-value",
    };
    expect(parsePublicEnvironment(environment)).toEqual({
      appUrl: "http://localhost:3000",
      supabaseUrl: "https://example.supabase.co",
      supabaseKey: "publishable-test",
    });
    expect(JSON.stringify(parsePublicEnvironment(environment))).not.toContain(
      "private-test-value",
    );
  });

  it("trata variáveis vazias como não configuradas", () => {
    expect(
      parsePublicEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: " ",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      }),
    ).toEqual({ appUrl: "http://localhost:3000" });
  });

  it("valida timezone e aplica Fortaleza como padrão", () => {
    expect(parseTimezone(undefined)).toBe("America/Fortaleza");
    expect(parseTimezone("America/Sao_Paulo")).toBe("America/Sao_Paulo");
    expect(() => parseTimezone("timezone/inexistente")).toThrow(
      ConfigurationError,
    );
    expect(() => parseTimezone("+03:00")).toThrow(ConfigurationError);
  });
});
