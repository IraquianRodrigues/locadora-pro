"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { valueLabels } from "@/lib/registry/config";
import { registryFieldGroups } from "@/lib/registry/field-groups";
import { schemas, type Resource } from "@/lib/registry/schema";
import {
  saveRegistryAction,
  searchRegistryOptionsAction,
} from "@/lib/registry/actions";
import { zodFormResolver } from "@/lib/forms/resolver";
import { priceFormDefaults, priceFormInput } from "@/lib/registry/form-dates";

type Values = Record<string, unknown>;
function fieldMessage(message: unknown) {
  const value = String(message ?? "Confira este campo.");
  if (value.startsWith("Invalid option")) return "Selecione uma opção válida.";
  if (/^Too (small|big)/.test(value))
    return "O valor está fora do intervalo permitido.";
  if (value.startsWith("Invalid ")) return "Confira o valor informado.";
  return value;
}
export function RegistryForm({
  resource,
  defaults,
  options,
  disabled,
  id,
  revision,
  timezone = "UTC",
}: {
  resource: Resource;
  defaults: Values;
  options: Record<string, { id: string; name: string }[]>;
  disabled: boolean;
  id?: string;
  revision?: string;
  timezone?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [lookupChoices, setLookupChoices] = useState(options),
    [lookupSearch, setLookupSearch] = useState<Record<string, string>>({}),
    [searching, setSearching] = useState(false);
  async function search(resource: Resource) {
    setSearching(true);
    try {
      const result = await searchRegistryOptionsAction(
        resource,
        lookupSearch[resource] ?? "",
      );
      if (result.ok)
        setLookupChoices((old) => ({ ...old, [resource]: result.data }));
      else setMessage(result.message);
    } catch {
      setMessage("Não foi possível buscar vínculos.");
    } finally {
      setSearching(false);
    }
  }
  // No cliente valida sem transformar; o servidor normaliza novamente antes da escrita.
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    defaultValues:
      resource === "precos" ? priceFormDefaults(defaults, timezone) : defaults,
    resolver: async (values) => {
      const price =
        resource === "precos"
          ? priceFormInput(values, timezone, defaults)
          : null;
      if (price?.error)
        return {
          values: {},
          errors: {
            [price.error]: {
              type: "validate",
              message: "Informe uma data e hora válida no fuso indicado.",
            },
          },
        };
      const result = await zodFormResolver<Values>(schemas[resource])(
        price?.input ?? values,
        undefined,
        { fields: {}, shouldUseNativeValidation: false },
      );
      return Object.keys(result.errors).length
        ? result
        : { values, errors: {} };
    },
  });
  async function submit(values: Values) {
    setMessage("");
    try {
      const price =
        resource === "precos"
          ? priceFormInput(values, timezone, defaults)
          : null;
      if (price?.error) {
        setError(price.error, {
          message: "Informe uma data e hora válida no fuso indicado.",
        });
        return;
      }
      const result = await saveRegistryAction(
        resource,
        price?.input ?? values,
        id,
        revision,
      );
      if (!result.ok) {
        setMessage(result.message);
        for (const [key, message] of Object.entries(result.fields ?? {}))
          setError(key, { message });
        return;
      }
      router.push(`/admin/${resource}/${result.id}?salvo=1`);
      router.refresh();
    } catch {
      setMessage("Não foi possível salvar. Tente novamente.");
    }
  }
  const control = "workspace-control";
  return (
    <form onSubmit={handleSubmit(submit)} className="workspace-form" noValidate>
      {resource === "precos" && (
        <p className="workspace-notice">
          Datas e horas no fuso {timezone}. Escolha uma categoria ou um veículo;
          o fim da vigência é exclusivo.
        </p>
      )}
      {registryFieldGroups(resource).map((group) => (
        <fieldset key={group.title} className="form-section">
          <legend>{group.title}</legend>
          {group.description && (
            <p className="form-section-description">{group.description}</p>
          )}
          <div className="form-grid">
            {group.fields.map((field) => {
              const label = `field-${field.name}`,
                error = errors[field.name],
                choices = field.lookup
                  ? (lookupChoices[field.lookup] ?? [])
                  : [],
                selected = field.lookup ? getValues(field.name) : undefined;
              const props = {
                id: label,
                disabled: disabled || isSubmitting,
                "aria-invalid": !!error,
                "aria-describedby":
                  [
                    field.help ? `${label}-help` : "",
                    error ? `${label}-error` : "",
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined,
              };
              return (
                <div
                  key={field.name}
                  className={
                    field.type === "textarea"
                      ? "form-field form-field-wide"
                      : "form-field"
                  }
                >
                  <label htmlFor={label} className="field-label">
                    {field.label}
                    {field.optional && (
                      <span className="field-optional"> (opcional)</span>
                    )}
                  </label>
                  {field.lookup && (
                    <div className="field-lookup">
                      <input
                        type="search"
                        aria-label={`Buscar ${field.label.toLowerCase()} por nome`}
                        value={lookupSearch[field.lookup] ?? ""}
                        maxLength={100}
                        disabled={disabled || searching || isSubmitting}
                        onChange={(e) =>
                          setLookupSearch((old) => ({
                            ...old,
                            [field.lookup!]: e.target.value,
                          }))
                        }
                        className={control}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={disabled || searching || isSubmitting}
                        onClick={() => search(field.lookup!)}
                      >
                        Buscar
                      </Button>
                    </div>
                  )}
                  {field.type === "select" ? (
                    <select
                      {...props}
                      {...register(field.name)}
                      className={control}
                    >
                      <option value="">Selecione</option>
                      {field.lookup ? (
                        <>
                          {!!selected &&
                            !choices.some((c) => c.id === selected) && (
                              <option value={String(selected)}>
                                Vínculo atual · {String(selected)}
                              </option>
                            )}
                          {choices.map((choice) => (
                            <option key={choice.id} value={choice.id}>
                              {choice.name} · {choice.id.slice(0, 8)}
                            </option>
                          ))}
                        </>
                      ) : (
                        field.options?.map((value) => (
                          <option key={value} value={value}>
                            {valueLabels[value] ?? value}
                          </option>
                        ))
                      )}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      {...props}
                      {...register(field.name)}
                      rows={4}
                      maxLength={5000}
                      className={control}
                    />
                  ) : (
                    <input
                      {...props}
                      {...register(field.name, {
                        valueAsNumber: field.type === "number",
                      })}
                      type={field.type ?? "text"}
                      step={
                        field.type === "number" ||
                        field.type === "datetime-local"
                          ? 1
                          : undefined
                      }
                      inputMode={
                        field.name === "amount" ||
                        field.name.endsWith("_amount")
                          ? "decimal"
                          : undefined
                      }
                      maxLength={
                        field.type === "text" || !field.type ? 2000 : undefined
                      }
                      className={
                        field.type === "checkbox"
                          ? "size-5 accent-primary"
                          : control
                      }
                    />
                  )}
                  {field.help && (
                    <p id={`${label}-help`} className="field-help">
                      {field.help}
                    </p>
                  )}
                  {error && (
                    <p
                      id={`${label}-error`}
                      role="alert"
                      className="field-error"
                    >
                      {fieldMessage(error.message)}
                    </p>
                  )}
                  {field.lookup && choices.length === 0 && (
                    <p className="field-help">
                      Nenhum vínculo ativo disponível. Cadastre ou ative{" "}
                      {field.lookup} antes de continuar.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
      {message && (
        <p role="alert" className="workspace-notice workspace-notice-attention">
          {message}
        </p>
      )}
      <div className="form-actions">
        <Button type="submit" disabled={disabled || isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar cadastro"}
        </Button>
        <Button asChild variant="outline">
          <Link href={`/admin/${resource}`}>
            {disabled ? "Voltar à lista" : "Cancelar"}
          </Link>
        </Button>
      </div>
      {disabled && (
        <p className="text-sm text-muted-foreground">
          Consulta somente. Para editar, é preciso permissão de escrita e
          cadastro não arquivado.
        </p>
      )}
    </form>
  );
}
