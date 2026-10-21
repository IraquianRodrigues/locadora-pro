"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { roleLabels, type StaffRole } from "./roles";
function SaveAccess() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando…" : "Salvar acesso"}
    </Button>
  );
}
export function AccessForm({
  id,
  name,
  active,
  role,
  action,
}: {
  id: string;
  name: string;
  active: boolean;
  role?: StaffRole;
  action: (form: FormData) => Promise<void>;
}) {
  const [error, setError] = useState("");
  return (
    <form
      aria-label={`Acesso de ${name}`}
      className="access-form"
      action={async (form) => {
        setError("");
        try {
          await action(form);
        } catch {
          setError("Não foi possível salvar o acesso. Tente novamente.");
        }
      }}
    >
      <input type="hidden" name="user_id" value={id} />
      <label className="field-label">
        Cargo
        <select
          name="role_code"
          className="workspace-control"
          defaultValue={role ?? "ATTENDANT"}
        >
          {Object.entries(roleLabels).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="administration-check">
        <input type="checkbox" name="active" defaultChecked={active} />
        Acesso ativo
      </label>
      <p className="business-context-note">
        Salvar substitui os cargos atuais por um único cargo. O último
        administrador ativo é preservado pelo servidor.
      </p>
      <SaveAccess />
      {error && (
        <p role="alert" className="business-feedback">
          {error}
        </p>
      )}
    </form>
  );
}
