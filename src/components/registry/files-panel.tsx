"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { publishImage } from "@/lib/public/admin-actions";
import {
  archiveRegistryFileAction,
  signRegistryFileAction,
  uploadRegistryFileAction,
} from "@/lib/registry/file-actions";
import {
  fileRules,
  type FileKind,
  type RegistryFile,
} from "@/lib/registry/file-schema";

export function FilesPanel({
  ownerId,
  kinds,
  files,
  writable,
  archived,
}: {
  ownerId: string;
  kinds: FileKind[];
  files: RegistryFile[];
  writable: FileKind[];
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [links, setLinks] = useState<Record<string, string>>({});
  async function upload(form: FormData) {
    setPending(true);
    setMessage("");
    try {
      const result = await uploadRegistryFileAction(form);
      setMessage(result.message);
      if (result.ok) router.refresh();
    } catch {
      setMessage("Não foi possível anexar. Confira tamanho e conexão.");
    } finally {
      setPending(false);
    }
  }
  async function download(id: string) {
    setPending(true);
    setMessage("");
    try {
      const result = await signRegistryFileAction(id);
      if (result.ok) setLinks((old) => ({ ...old, [id]: result.url }));
      else setMessage(result.message);
    } catch {
      setMessage("Não foi possível gerar o link.");
    } finally {
      setPending(false);
    }
  }
  async function archive(id: string) {
    setPending(true);
    setMessage("");
    try {
      const result = await archiveRegistryFileAction(id);
      setMessage(result.message);
      if (result.ok) {
        setLinks((old) => {
          const next = { ...old };
          delete next[id];
          return next;
        });
        router.refresh();
      }
    } catch {
      setMessage("Não foi possível arquivar o arquivo.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section aria-labelledby="files-title" className="workspace-section">
      <h2 id="files-title" className="text-xl font-bold">
        Arquivos e publicação de fotos
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        JPEG, PNG ou WebP; documentos também aceitam PDF. Máximo 4 MiB. Imagens
        são convertidas para JPEG sem metadados. Links para download duram 60
        segundos. Documentos permanecem privados. Fotos só aparecem no catálogo
        após publicação explícita.
      </p>
      {!archived && writable.length > 0 && (
        <form action={upload} className="files-upload form-grid">
          <input type="hidden" name="owner_id" value={ownerId} />
          <label className="text-sm font-semibold">
            Tipo
            <select
              name="kind"
              required
              disabled={pending}
              className="workspace-control mt-2"
            >
              {writable.map((kind) => (
                <option key={kind} value={kind}>
                  {fileRules[kind].title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Descrição
            <input
              name="label"
              required
              maxLength={120}
              disabled={pending}
              className="workspace-control mt-2"
            />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Arquivo
            <input
              name="file"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={pending}
              className="workspace-control mt-2"
            />
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? "Aguarde…" : "Anexar arquivo"}
          </Button>
        </form>
      )}
      {message && (
        <p
          role="status"
          className="mt-5 rounded-lg border border-border p-4 text-sm"
        >
          {message}
        </p>
      )}
      {files.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Nenhum arquivo que seu perfil possa consultar.
        </p>
      ) : (
        <ul className="files-list">
          {files
            .filter((file) => kinds.includes(file.kind))
            .map((file) => (
              <li key={file.id}>
                <div>
                  <p className="font-semibold">{file.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {fileRules[file.kind].title} ·{" "}
                    {Math.ceil(file.byte_size / 1024)} KiB ·{" "}
                    {
                      {
                        READY: "Disponível",
                        PENDING: "Pendente de conclusão",
                        FAILED: "Upload falhou",
                        ARCHIVED: "Arquivado",
                      }[file.status]
                    }
                  </p>
                </div>
                {file.status === "READY" && (
                  <div className="flex flex-wrap gap-3">
                    {links[file.id] ? (
                      <a
                        href={links[file.id]}
                        rel="noopener noreferrer"
                        referrerPolicy="no-referrer"
                        download
                        className="inline-flex min-h-11 items-center underline underline-offset-4"
                      >
                        Baixar arquivo (60 s)
                      </a>
                    ) : null}
                    <Button
                      variant="outline"
                      disabled={pending}
                      type="button"
                      onClick={() => download(file.id)}
                    >
                      Gerar link temporário
                    </Button>
                    {writable.includes(file.kind) && (
                      <Button
                        variant="ghost"
                        type="button"
                        disabled={pending}
                        onClick={() => archive(file.id)}
                      >
                        Arquivar arquivo
                      </Button>
                    )}
                    {file.kind === "VEHICLE_IMAGE" &&
                      writable.includes(file.kind) && (
                        <Button
                          variant="outline"
                          type="button"
                          disabled={pending}
                          onClick={async () => {
                            setPending(true);
                            try {
                              const result = await publishImage(
                                file.id,
                                !file.public_visible,
                              );
                              setMessage(result.message);
                              if (result.ok) router.refresh();
                            } finally {
                              setPending(false);
                            }
                          }}
                        >
                          {file.public_visible
                            ? "Retirar imagem do site"
                            : "Publicar imagem no site"}
                        </Button>
                      )}
                  </div>
                )}
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
