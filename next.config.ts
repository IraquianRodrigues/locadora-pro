import type { NextConfig } from "next";
import { parsePublicEnvironment } from "./src/config/env";
// Impede incorporar uma chave privilegiada ao bundle público antes do build.
parsePublicEnvironment(process.env);

const config: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/*": ["./assets/fonts/*", "./assets/workers/*"],
  },
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...(process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://")
            ? [{ key: "Strict-Transport-Security", value: "max-age=15552000" }]
            : []),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value:
              "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; frame-src https://challenges.cloudflare.com",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      ...[
        "/login",
        "/recuperar-senha",
        "/atualizar-senha",
        "/auth/:path*",
        "/acesso-negado",
        "/api/v1/admin/:path*",
        "/api/v1/public/:path*",
        "/reservar",
        "/consultar-reserva",
      ].map((source) => ({
        source,
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      })),
    ];
  },
};

export default config;
