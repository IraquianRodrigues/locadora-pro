"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  businessJobsAction,
  readNotificationAction,
} from "@/lib/business/actions";
import { Button } from "@/components/ui/button";
export function MarkRead({ id }: { id: string }) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await readNotificationAction(id);
            if (!r.ok) setError(r.message);
            else router.refresh();
          } catch {
            setError("Não foi possível registrar a leitura. Tente novamente.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Registrando…" : "Marcar como lida"}
      </Button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
export function BusinessJobsButton() {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [ok, setOk] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div className="my-5 space-y-3">
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          setOk(false);
          try {
            const r = await businessJobsAction();
            setOk(r.ok);
            setMessage(
              r.ok
                ? `${r.completed} evento(s) processado(s), ${r.deliveries} notificação(ões) criada(s), ${r.sent} e-mail(s) aceito(s), ${r.failed + r.email_failed} falha(s). ${r.email_configured ? "" : "E-mail sem configuração; fila preservada."}`
                : r.message,
            );
            if (r.ok) router.refresh();
          } catch {
            setMessage(
              "Não foi possível processar a fila. Confira a conexão e tente novamente.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Processando…" : "Processar alertas e notificações"}
      </Button>
      {message && (
        <p className="business-feedback" role={ok ? "status" : "alert"}>
          {message}
        </p>
      )}
    </div>
  );
}
