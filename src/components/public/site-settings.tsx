"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { savePublicSite } from "@/lib/public/admin-actions";
export function SiteSettings({
  initial,
  version,
}: {
  initial: Record<string, unknown>;
  version: number;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [saved, setSaved] = useState(false),
    router = useRouter();
  return (
    <form
      aria-label="Publicação do site"
      aria-busy={busy}
      className="site-settings-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setMessage("");
        setSaved(false);
        const form = new FormData(e.currentTarget),
          raw = {
            ...Object.fromEntries(form),
            enabled: form.get("enabled") === "on",
          };
        try {
          const result = await savePublicSite(raw, version);
          setSaved(result.ok);
          setMessage(result.message);
          if (result.ok) router.refresh();
        } catch {
          setMessage(
            "Não foi possível salvar. Confira a conexão e tente novamente.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <section
          id="contato"
          className="business-section"
          aria-labelledby="contato-title"
        >
          <h2 id="contato-title">Contato de atendimento</h2>
          <p className="business-context-note">
            Informações que serão exibidas no site público.
          </p>
          <div className="administration-fields">
            {[
              ["name", "Nome público da locadora"],
              ["email", "E-mail de atendimento"],
              ["phone", "Telefone com DDD (somente dígitos)"],
              ["address", "Endereço público de atendimento"],
            ].map(([key, label]) => (
              <label key={key} className="field-label">
                {label}
                <input
                  name={key}
                  required
                  type={
                    key === "email" ? "email" : key === "phone" ? "tel" : "text"
                  }
                  inputMode={key === "phone" ? "numeric" : undefined}
                  maxLength={
                    key === "address"
                      ? 500
                      : key === "name"
                        ? 120
                        : key === "phone"
                          ? 11
                          : 254
                  }
                  pattern={key === "phone" ? "[0-9]{10,11}" : undefined}
                  defaultValue={String(initial[key] ?? "")}
                  className="workspace-control"
                />
              </label>
            ))}
          </div>
        </section>
        <section
          id="politicas"
          className="business-section"
          aria-labelledby="politicas-title"
        >
          <h2 id="politicas-title">Políticas e condições</h2>
          <p className="business-context-note">
            Use textos aprovados pela empresa. O conteúdo é publicado como texto
            simples.
          </p>
          <div className="administration-fields administration-fields-single">
            {[
              [
                "terms",
                "Condições de locação, cancelamento e pagamento na retirada aprovadas",
              ],
              ["privacy", "Política de privacidade aprovada"],
            ].map(([key, label]) => (
              <label key={key} className="field-label">
                {label}
                <textarea
                  name={key}
                  rows={8}
                  required
                  minLength={30}
                  maxLength={20000}
                  defaultValue={String(initial[key] ?? "")}
                  className="workspace-control"
                />
              </label>
            ))}
          </div>
        </section>
        <section
          id="publicacao"
          className="business-section"
          aria-labelledby="publicacao-title"
        >
          <h2 id="publicacao-title">Publicação</h2>
          <label className="administration-check">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={initial.enabled === true}
            />
            Publicar catálogo, contato e políticas; habilitar fluxo online após
            configurar antispam
          </label>
          <p className="business-context-note">
            Cada salvamento gera uma nova versão de aceite. Versão atual:{" "}
            {version}. Revise contato, políticas, planos e adicionais antes de
            habilitar.
          </p>
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando…" : "Salvar publicação"}
          </Button>
        </section>
      </fieldset>
      {message && (
        <p role={saved ? "status" : "alert"} className="business-feedback">
          {message}
        </p>
      )}
    </form>
  );
}
