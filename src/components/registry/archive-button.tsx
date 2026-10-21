"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { archiveRegistryAction } from "@/lib/registry/actions";
import type { Resource } from "@/lib/registry/schema";
export function ArchiveButton({
  resource,
  id,
  revision,
  archived,
}: {
  resource: Resource;
  id: string;
  revision: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  async function submit() {
    setPending(true);
    setMessage("");
    try {
      const result = await archiveRegistryAction(
        resource,
        id,
        revision,
        !archived,
      );
      if (!result.ok) setMessage(result.message);
      else router.refresh();
    } catch {
      setMessage("Não foi possível concluir. Tente novamente.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        onClick={submit}
        disabled={pending}
      >
        {pending
          ? "Aguarde…"
          : archived
            ? "Restaurar cadastro"
            : "Arquivar cadastro"}
      </Button>
      {message && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {message}
        </p>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        Arquivar preserva os dados e as referências históricas.
      </p>
    </div>
  );
}
