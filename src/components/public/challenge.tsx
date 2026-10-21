"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
type Widget = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Widget;
  }
}
export function Challenge({
  siteKey,
  action,
  onToken,
  reset,
}: {
  siteKey: string;
  action: "quote" | "reservation";
  onToken: (token: string) => void;
  reset: number;
}) {
  const ref = useRef<HTMLDivElement>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!ready || !ref.current || !window.turnstile) return;
    const widget = window.turnstile,
      id = widget.render(ref.current, {
        sitekey: siteKey,
        action,
        language: "pt-br",
        size: "compact",
        callback: (token: string) => {
          setError("");
          onToken(token);
        },
        "expired-callback": () => onToken(""),
        "error-callback": () => {
          onToken("");
          setError(
            "A verificação não carregou. Verifique a conexão e tente novamente.",
          );
        },
      });
    return () => widget.remove(id);
  }, [ready, siteKey, action, onToken, reset]);
  return (
    <div className="my-4">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() =>
          setError("Verificação indisponível. Tente novamente mais tarde.")
        }
      />
      <p className="mb-2 text-sm">Verificação de segurança</p>
      <div ref={ref} />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
