import type { Metadata } from "next";
import localFont from "next/font/local";
import { getServerEnvironment } from "@/config/server-env";
import "./globals.css";
const manrope = localFont({
  src: "../../assets/fonts/Manrope-Variable.ttf",
  display: "swap",
  variable: "--font-ui",
  weight: "200 800",
});

export const metadata: Metadata = {
  title: {
    default: "Apex | Locação de veículos",
    template: "%s | Apex",
  },
  description:
    "Apex. Consulte informações sobre locação de veículos e disponibilidade do atendimento online.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  getServerEnvironment();
  return (
    <html lang="pt-BR" className={manrope.variable}>
      <body className="min-h-screen antialiased">
        <a
          href="#conteudo"
          className="sr-only fixed top-3 left-3 z-50 rounded-lg bg-primary px-4 py-3 text-white focus:not-sr-only"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
