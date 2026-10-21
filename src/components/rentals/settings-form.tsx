"use client";
import type { OperationalPolicy } from "@/lib/rentals/schema";
import { OperationForm, control } from "./operation-form";
export function RentalSettingsForm({
  policy,
  updatedAt,
  contracts,
  inspections,
  company,
}: {
  policy: OperationalPolicy | null;
  updatedAt: string | null;
  contracts: {
    id: string;
    template_key: string;
    version: number;
    review_status: string;
  }[];
  inspections: { id: string; name: string; version: number }[];
  company: {
    legal_name: string;
    tax_document: string;
    timezone: string;
    updated_at: string;
    contact: Record<string, unknown>;
  } | null;
}) {
  const contact = company?.contact ?? {},
    addr =
      contact.address && typeof contact.address === "object"
        ? (contact.address as Record<string, unknown>)
        : {};
  return (
    <div className="rental-settings-forms">
      <OperationForm
        kind="setup"
        title="Salvar dados da locadora"
        build={(f) => ({
          kind: "COMPANY",
          expected_updated_at: company?.updated_at ?? null,
          legal_name: String(f.get("legal_name")),
          tax_document: String(f.get("tax_document")),
          timezone: String(f.get("timezone")),
          contact: {
            email: String(f.get("email")),
            phone: String(f.get("phone")),
            address: Object.fromEntries(
              [
                "postal_code",
                "street",
                "number",
                "complement",
                "district",
                "city",
                "state",
              ].map((k) => [k, String(f.get(k))]),
            ),
          },
        })}
      >
        <p>
          A identidade será congelada em cada nova locação e aparecerá nos
          contratos.
        </p>
        {[
          ["legal_name", "Razão social", company?.legal_name],
          ["tax_document", "CNPJ", company?.tax_document],
          ["email", "E-mail", contact.email],
          ["phone", "Telefone", contact.phone],
          ["timezone", "Fuso IANA", company?.timezone ?? "America/Fortaleza"],
        ].map(([name, label, value]) => (
          <label key={String(name)} className="field-label">
            {String(label)}
            <input
              className={control}
              name={String(name)}
              defaultValue={String(value ?? "")}
              maxLength={200}
              required
            />
          </label>
        ))}
        <fieldset className="form-grid">
          <legend>Endereço da locadora</legend>
          {[
            ["postal_code", "CEP"],
            ["street", "Logradouro"],
            ["number", "Número"],
            ["complement", "Complemento"],
            ["district", "Bairro"],
            ["city", "Cidade"],
            ["state", "UF"],
          ].map(([name, label]) => (
            <label key={name}>
              {label}
              <input
                className={control}
                name={name}
                defaultValue={String(addr[name] ?? "")}
                maxLength={160}
                required={name !== "complement"}
              />
            </label>
          ))}
        </fieldset>
      </OperationForm>
      <OperationForm
        kind="setup"
        title="Criar versão de checklist"
        build={(f) => ({
          kind: "INSPECTION_TEMPLATE",
          name: String(f.get("name")),
          version: Number(f.get("version")),
          checklist: String(f.get("items"))
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean)
            .map((label, index) => ({
              key: `item_${index + 1}`,
              label,
              photo_required: f.get("photos") === "on",
            })),
        })}
      >
        <label className="field-label">
          Nome
          <input className={control} name="name" maxLength={100} required />
        </label>
        <label className="field-label">
          Versão
          <input
            className={control}
            type="number"
            name="version"
            min={1}
            required
          />
        </label>
        <label className="field-label">
          Itens, um por linha (até 80)
          <textarea
            className={control}
            name="items"
            rows={6}
            required
            placeholder={"Pintura e lataria\nPneus\nInterior e acessórios"}
          />
        </label>
        <label className="field-label">
          <input type="checkbox" name="photos" /> Exigir foto de todos os itens
        </label>
        <p>
          Avarias e ausências sempre exigem foto e descrição. Uma versão criada
          é imutável.
        </p>
      </OperationForm>
      <OperationForm
        kind="setup"
        title="Criar versão de contrato"
        build={(f) => ({
          kind: "CONTRACT_TEMPLATE",
          name: String(f.get("name")),
          version: Number(f.get("version")),
          body: String(f.get("body")),
          review_status:
            f.get("approved") === "on" ? "APPROVED" : "LEGAL_REVIEW_REQUIRED",
          legal_review_confirmed: f.get("approved") === "on",
        })}
      >
        <label className="field-label">
          Nome do modelo
          <input className={control} name="name" maxLength={100} required />
        </label>
        <label className="field-label">
          Versão
          <input
            className={control}
            type="number"
            name="version"
            min={1}
            required
          />
        </label>
        <label className="field-label">
          Cláusulas revisadas
          <textarea
            className={control}
            name="body"
            minLength={30}
            maxLength={40000}
            rows={10}
            required
          />
        </label>
        <p>
          As partes, veículo, preços, política, logística, condutores e vistoria
          serão acrescentados ao PDF. Insira as cláusulas como texto, sem campos
          de substituição.
        </p>
        <label className="field-label">
          <input type="checkbox" name="approved" /> Confirmo que esta versão
          passou pela revisão jurídica e está aprovada para uso.
        </label>
      </OperationForm>
      <OperationForm
        kind="setup"
        title="Salvar regras operacionais"
        build={(f) => ({
          kind: "POLICY",
          expected_updated_at: updatedAt,
          policy: {
            version: 1,
            inspection_template_id: String(f.get("inspection_template_id")),
            contract_template_id: String(f.get("contract_template_id")),
            checkout_payment: String(f.get("checkout_payment")),
            checkin_balance: String(f.get("checkin_balance")),
            require_deposit: f.get("require_deposit") === "on",
            require_documents: f.get("require_documents") === "on",
            license_categories: f.getAll("license_categories"),
            included_km_per_day: Number(f.get("included_km_per_day")),
            late_tolerance_minutes: Number(f.get("late_tolerance_minutes")),
            extra_km_amount: String(f.get("extra_km_amount")),
            fuel_percent_amount: String(f.get("fuel_percent_amount")),
            late_hour_amount: String(f.get("late_hour_amount")),
          },
        })}
      >
        <p>
          As regras serão congeladas em cada nova locação. Alterações não
          reescrevem contratos ou locações existentes. Preencha todos os campos;
          valores zero significam ausência da cobrança correspondente.
        </p>
        <label className="field-label">
          Checklist padrão
          <select
            className={control}
            name="inspection_template_id"
            defaultValue={policy?.inspection_template_id ?? ""}
            required
          >
            <option value="">Escolha</option>
            {inspections.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · v{t.version}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Modelo jurídico aprovado
          <select
            className={control}
            name="contract_template_id"
            defaultValue={policy?.contract_template_id ?? ""}
            required
          >
            <option value="">Escolha</option>
            {contracts
              .filter((t) => t.review_status === "APPROVED")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.template_key} · v{t.version}
                </option>
              ))}
          </select>
        </label>
        <label className="field-label">
          Recebimento para retirada
          <select
            className={control}
            name="checkout_payment"
            defaultValue={policy?.checkout_payment ?? ""}
            required
          >
            <option value="">Escolha explicitamente</option>
            <option value="FULL">Exigir quitação integral confirmada</option>
            <option value="NONE">Dispensar recebimento prévio</option>
          </select>
        </label>
        <label className="field-label">
          Saldo para fechamento
          <select
            className={control}
            name="checkin_balance"
            defaultValue={policy?.checkin_balance ?? ""}
            required
          >
            <option value="">Escolha explicitamente</option>
            <option value="SETTLED">Exigir quitação</option>
            <option value="ALLOW_DUE">Permitir saldo a receber</option>
          </select>
        </label>
        <label className="field-label">
          <input
            type="checkbox"
            name="require_deposit"
            defaultChecked={policy?.require_deposit ?? false}
          />{" "}
          Exigir caução confirmada conforme cotação
        </label>
        <label className="field-label">
          <input
            type="checkbox"
            name="require_documents"
            defaultChecked={policy?.require_documents ?? false}
          />{" "}
          Exigir documentos do cliente e CNHs anexados e confirmados
        </label>
        <fieldset className="rental-license-options">
          <legend>Categorias de CNH aceitas</legend>
          {["B", "C", "D", "E", "AB", "AC", "AD", "AE"].map((c) => (
            <label key={c} className="inline-block py-2">
              <input
                type="checkbox"
                name="license_categories"
                value={c}
                defaultChecked={
                  policy?.license_categories.some((value) => value === c) ??
                  false
                }
              />{" "}
              {c}
            </label>
          ))}
        </fieldset>
        {(
          [
            [
              "included_km_per_day",
              "Km incluídos por dia de 24 horas",
              "number",
            ],
            [
              "extra_km_amount",
              "Valor por km excedente (R$, com ponto decimal)",
              "text",
            ],
            [
              "fuel_percent_amount",
              "Valor por ponto percentual de combustível (R$)",
              "text",
            ],
            [
              "late_tolerance_minutes",
              "Tolerância de atraso em minutos",
              "number",
            ],
            [
              "late_hour_amount",
              "Valor por hora iniciada após a tolerância (R$)",
              "text",
            ],
          ] as const
        ).map(([name, label, type]) => (
          <label key={name} className="field-label">
            {label}
            <input
              name={name}
              type={type}
              className={control}
              defaultValue={policy?.[name] ?? ""}
              min={0}
              max={name === "late_tolerance_minutes" ? 1440 : 9999999}
              step={type === "number" ? 1 : undefined}
              required
              inputMode={type === "text" ? "decimal" : "numeric"}
              pattern={type === "text" ? "[0-9]+\\.[0-9]{2}" : undefined}
            />
          </label>
        ))}
      </OperationForm>
      <h2 className="text-xl font-semibold">Modelos cadastrados</h2>
      <ul className="space-y-2">
        {contracts.map((t) => (
          <li key={t.id}>
            {t.template_key} · v{t.version} ·{" "}
            {t.review_status === "APPROVED"
              ? "Aprovado"
              : "Revisão jurídica pendente"}
          </li>
        ))}
      </ul>
    </div>
  );
}
