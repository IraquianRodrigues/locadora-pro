"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { statusLabels } from "@/lib/reservations/labels";
export function StatusForm() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="mt-7 space-y-5 rounded-xl border border-border p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        const f = new FormData(e.currentTarget);
        try {
          const r = await fetch(
            `/api/v1/public/reservations/${encodeURIComponent(String(f.get("id")))}/status`,
            {
              headers: { "X-Reservation-Token": String(f.get("token")) },
              cache: "no-store",
            },
          );
          const body = await r.json();
          setMessage(
            r.ok
              ? `Situação: ${statusLabels[body.data.status] ?? "Em atendimento"}. ${body.data.status === "CONFIRMED" ? "Confirmação registrada. Consulte o atendimento para os próximos passos." : "Acompanhe as orientações do atendimento antes da retirada."}`
              : (body.error?.message ?? "Consulta indisponível."),
          );
        } catch {
          setMessage("Consulta indisponível. Tente novamente.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block">
        Referência da solicitação
        <input
          name="id"
          required
          maxLength={36}
          disabled={busy}
          className="mt-2 min-h-11 w-full rounded border border-border px-3"
          autoComplete="off"
        />
      </label>
      <label className="block">
        Token de consulta
        <input
          name="token"
          type="password"
          required
          minLength={43}
          maxLength={43}
          disabled={busy}
          className="mt-2 min-h-11 w-full rounded border border-border px-3"
          autoComplete="off"
        />
      </label>
      <Button disabled={busy}>
        {busy ? "Consultando…" : "Consultar situação"}
      </Button>
      {message && (
        <p role="status" className="rounded-lg bg-muted p-4">
          {message}
        </p>
      )}
    </form>
  );
}
