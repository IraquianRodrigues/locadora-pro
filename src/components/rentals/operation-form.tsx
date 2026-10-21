"use client";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  rentalAction,
  rentalJobsAction,
  rentalFileAction,
  inspectionPhotoAction,
} from "@/lib/rentals/actions";
import { Button } from "@/components/ui/button";
export const control = "workspace-control";
export function OperationForm({
  title,
  kind = "command",
  build,
  children,
  navigate = false,
  collapsible = false,
}: {
  title: string;
  kind?: "create" | "command" | "extend" | "setup";
  build: (data: FormData) => unknown;
  children?: ReactNode;
  navigate?: boolean;
  collapsible?: boolean;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    attempt = useRef<{ payload: string; key: string } | null>(null);
  const form = (
    <form
      aria-label={title}
      aria-busy={busy}
      className="rental-operation-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
          const input = build(new FormData(e.currentTarget)),
            payload = JSON.stringify(input);
          if (attempt.current?.payload !== payload)
            attempt.current = { payload, key: crypto.randomUUID() };
          const result = await rentalAction(kind, input, attempt.current!.key);
          if (result.ok) {
            setMessage(
              "awaiting_payment" in result && result.awaiting_payment
                ? "Devolução apurada. Aguarde a liquidação pelo financeiro e confirme novamente após atualizar a página."
                : "Operação registrada.",
            );
            if (navigate && result.id)
              router.push(`/admin/locacoes/${result.id}`);
            router.refresh();
          } else setMessage(result.message);
        } catch {
          setMessage(
            "Não foi possível concluir a operação. Confira os dados e tente novamente.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {!collapsible && <h3>{title}</h3>}
      <fieldset disabled={busy} className="rental-operation-fields">
        {children}
        <Button type="submit">{busy ? "Registrando…" : title}</Button>
      </fieldset>
      {message && (
        <p role="status" className="workspace-alert">
          {message}
        </p>
      )}
    </form>
  );
  return collapsible ? (
    <details className="rental-disclosure">
      <summary>{title}</summary>
      {form}
    </details>
  ) : (
    form
  );
}
export function ConvertReservation({
  id,
  version,
}: {
  id: string;
  version: number;
}) {
  return (
    <OperationForm
      title="Converter em locação"
      kind="create"
      navigate
      build={() => ({ reservation_id: id, expected_version: version })}
    >
      <p>
        A reserva deve estar confirmada. O veículo e a cotação serão
        preservados.
      </p>
    </OperationForm>
  );
}
export function JobsButton() {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div className="rental-job-control">
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await rentalJobsAction();
            setMessage(
              r.ok
                ? `${r.generated} PDF(s) gerado(s), ${r.failed} falha(s), ${r.overdue} atraso(s) atualizado(s).`
                : r.message,
            );
            router.refresh();
          } catch {
            setMessage("Não foi possível processar a fila. Tente novamente.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Processando…" : "Processar contratos e atualizar atrasos"}
      </Button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
export function FileButton({
  id,
  kind,
  label,
}: {
  id: string;
  kind: "contract" | "photo";
  label: string;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [url, setUrl] = useState("");
  return (
    <div className="rental-file-control">
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setUrl("");
          try {
            const r = await rentalFileAction(id, kind);
            if (r.ok) {
              setUrl(r.url);
              setMessage("Link disponível por 60 segundos.");
            } else setMessage(r.message);
          } catch {
            setMessage("Não foi possível obter o arquivo. Tente novamente.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {label}
      </Button>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="ml-4 underline"
        >
          Baixar arquivo
        </a>
      )}
      {message && (
        <p role="status" className="mt-2 text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
export function PhotoUpload({
  inspectionId,
  itemId,
}: {
  inspectionId: string;
  itemId: string;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      aria-label="Anexar foto do item"
      className="rental-photo-upload"
      aria-busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        const form = new FormData(e.currentTarget);
        form.set("inspection_id", inspectionId);
        form.set("item_id", itemId);
        try {
          const r = await inspectionPhotoAction(form);
          setMessage(r.ok ? "Foto confirmada." : r.message);
          router.refresh();
        } catch {
          setMessage("Não foi possível enviar a foto. Tente novamente.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block">
        Foto do item (até 4 MiB)
        <input
          className={control}
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp"
          required
          disabled={busy}
        />
      </label>
      <Button size="sm" variant="outline" disabled={busy}>
        {busy ? "Enviando…" : "Anexar foto"}
      </Button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
