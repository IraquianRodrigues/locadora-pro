"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { decisionAction, expiryAction } from "@/lib/reservations/actions";
import { statusLabels } from "@/lib/reservations/labels";
export function DecisionForm({
  id,
  version,
  status,
  permissions,
  expired,
}: {
  id: string;
  version: number;
  status: string;
  permissions: string[];
  expired: boolean;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    attempt = useRef<{ payload: string; key: string } | null>(null);
  const pending = ["REQUESTED", "UNDER_REVIEW"].includes(status);
  const targets = [
    ...(status === "REQUESTED" && permissions.includes("reservations.review")
      ? ["UNDER_REVIEW"]
      : []),
    ...(pending && permissions.includes("reservations.approve")
      ? ["CONFIRMED", "REJECTED"]
      : []),
    ...((pending && permissions.includes("reservations.cancel_pending")) ||
    (status === "CONFIRMED" &&
      permissions.includes("reservations.cancel_confirmed"))
      ? ["CANCELLED"]
      : []),
  ];
  if (!targets.length) return null;
  if (expired && pending)
    return (
      <p className="workspace-notice workspace-notice-attention">
        Prazo de análise expirado. Execute a expiração para registrar o estado
        no histórico.
      </p>
    );
  return (
    <form
      className="decision-form workspace-section"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        const form = new FormData(e.currentTarget),
          payload = JSON.stringify([
            version,
            form.get("target"),
            form.get("reason"),
          ]);
        if (attempt.current?.payload !== payload)
          attempt.current = { payload, key: crypto.randomUUID() };
        try {
          const r = await decisionAction(id, {
            expected_version: version,
            target: form.get("target"),
            reason: form.get("reason"),
            idempotency_key: attempt.current!.key,
          });
          if (r.ok) {
            setMessage("Decisão registrada.");
            router.refresh();
          } else setMessage(r.message);
        } catch {
          setMessage("Operação indisponível. Tente novamente.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-xl font-semibold">Analisar reserva</h2>
      <label className="field-label">
        Decisão
        <select name="target" disabled={busy} className="workspace-control">
          {targets.map((t) => (
            <option key={t} value={t}>
              {statusLabels[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="field-label">
        Motivo
        <textarea
          name="reason"
          required
          minLength={5}
          maxLength={500}
          disabled={busy}
          className="workspace-control"
        />
      </label>
      <Button disabled={busy}>
        {busy ? "Registrando…" : "Registrar decisão"}
      </Button>
      {message && (
        <p role="status" className="workspace-notice">
          {message}
        </p>
      )}
    </form>
  );
}
export function ExpiryButton() {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await expiryAction();
            setMessage(
              r.ok
                ? `${r.count} reserva(s) expirada(s) neste lote.`
                : r.message,
            );
            if (r.ok) router.refresh();
          } catch {
            setMessage("Expiração indisponível.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Processando…" : "Expirar solicitações vencidas"}
      </Button>
      {message && (
        <p role="status" className="mt-2 text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
