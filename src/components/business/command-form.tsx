"use client";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { businessMutation, type BusinessDomain } from "@/lib/business/actions";
import { Button } from "@/components/ui/button";
export const control = "workspace-control";
export function CommandForm({
  title,
  domain,
  build,
  children,
  navigate,
  collapsible = false,
  showTitle = true,
  disclosureLabel,
}: {
  title: string;
  domain: BusinessDomain;
  build: (form: FormData) => unknown;
  children?: ReactNode;
  navigate?: "maintenance";
  collapsible?: boolean;
  showTitle?: boolean;
  disclosureLabel?: string;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [message, setMessage] = useState(""),
    attempt = useRef<{ payload: string; key: string } | null>(null);
  const form = (
    <form
      aria-label={title}
      aria-busy={busy}
      className="business-command"
      onChange={() => setDone(false)}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || done) return;
        setBusy(true);
        try {
          const input = build(new FormData(e.currentTarget)),
            payload = JSON.stringify(input);
          if (attempt.current?.payload !== payload)
            attempt.current = { payload, key: crypto.randomUUID() };
          const r = await businessMutation(domain, input, attempt.current!.key);
          if (r.ok) {
            setMessage(`Registrado: ${r.id.slice(0, 8)}.`);
            setDone(true);
            if (navigate) router.push(`/admin/manutencao/${r.id}`);
            router.refresh();
          } else setMessage(r.message);
        } catch {
          setMessage(
            "Não foi possível concluir. Confira os dados e tente novamente sem alterá-los.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {!collapsible && showTitle && (
        <h2 className="business-command-title">{title}</h2>
      )}
      <fieldset disabled={busy || done} className="business-command-fields">
        {children}
        <Button type="submit">
          {busy ? "Registrando…" : done ? "Registrado" : title}
        </Button>
      </fieldset>
      {message && (
        <p role={done ? "status" : "alert"} className="business-feedback">
          {message}
        </p>
      )}
      {done && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            attempt.current = null;
            setDone(false);
            setMessage("");
          }}
        >
          Novo lançamento
        </Button>
      )}
    </form>
  );
  return collapsible ? (
    <details className="business-disclosure">
      <summary>{disclosureLabel ?? title}</summary>
      {form}
    </details>
  ) : (
    form
  );
}
export function Field({
  name,
  label,
  type = "text",
  value,
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  required?: boolean;
}) {
  return (
    <label className="field-label">
      {label}
      <input
        className={control}
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        min={type === "number" ? 0 : undefined}
        maxLength={1000}
      />
    </label>
  );
}
export function MoneyField({
  name = "amount",
  label = "Valor (R$, com ponto decimal)",
}: {
  name?: string;
  label?: string;
}) {
  return (
    <label className="field-label">
      {label}
      <input
        className={control}
        name={name}
        required
        inputMode="decimal"
        pattern="[0-9]+\.[0-9]{2}"
        placeholder="100.00"
        maxLength={13}
      />
    </label>
  );
}
export function ReasonField({
  label = "Motivo ou fundamentação",
  name = "reason",
}: {
  label?: string;
  name?: string;
}) {
  return (
    <label className="field-label">
      {label}
      <textarea
        className={control}
        name={name}
        required
        minLength={5}
        maxLength={1000}
      />
    </label>
  );
}
export function SelectField({
  name,
  label,
  options,
  optional = false,
  value,
}: {
  name: string;
  label: string;
  options: { id: string; name: string }[];
  optional?: boolean;
  value?: string;
}) {
  return (
    <label className="field-label">
      {label}
      <select
        className={control}
        name={name}
        required={!optional}
        defaultValue={value ?? ""}
      >
        <option value="">{optional ? "Sem vínculo" : "Escolha"}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export const value = (f: FormData, key: string) => String(f.get(key) ?? "");
export const nullable = (f: FormData, key: string) => value(f, key) || null;
