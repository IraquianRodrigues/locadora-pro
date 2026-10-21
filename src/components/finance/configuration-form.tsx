"use client";
import {
  CommandForm,
  Field,
  control,
  value,
} from "@/components/business/command-form";
export function FinanceConfigurationForm({
  methods,
  policy,
}: {
  methods: { id: string; name: string; active: boolean; updated_at: string }[];
  policy: {
    value: { admin_discount_bps: number; manager_discount_bps: number };
    version: number;
  } | null;
}) {
  return (
    <div>
      <CommandForm
        collapsible
        title="Cadastrar meio de pagamento"
        domain="finance-setup"
        build={(f) => ({
          kind: "METHOD",
          id: null,
          name: value(f, "name"),
          active: true,
          expected_updated_at: null,
        })}
      >
        <Field
          name="name"
          label="Nome (dinheiro, Pix presencial, cartão presencial, transferência…)"
        />
      </CommandForm>
      {methods.map((m) => (
        <CommandForm
          collapsible
          key={m.id}
          title={`Salvar meio: ${m.name}`}
          domain="finance-setup"
          build={(f) => ({
            kind: "METHOD",
            id: m.id,
            name: value(f, "name"),
            active: f.get("active") === "on",
            expected_updated_at: m.updated_at,
          })}
        >
          <Field name="name" label="Nome" value={m.name} />
          <label className="field-label">
            <input type="checkbox" name="active" defaultChecked={m.active} />{" "}
            Habilitado para novos lançamentos
          </label>
        </CommandForm>
      ))}
      <CommandForm
        collapsible
        title="Salvar limites de desconto financeiro"
        domain="finance-setup"
        build={(f) => ({
          kind: "POLICY",
          admin_discount_bps: Number(value(f, "admin_discount_bps")),
          manager_discount_bps: Number(value(f, "manager_discount_bps")),
          expected_version: policy?.version ?? 0,
        })}
      >
        <p>
          Limites em pontos-base: 100 = 1%, 1000 = 10%, 10000 = 100%. O limite é
          cumulativo por cobrança; não altera descontos comerciais já
          contratados. Sem política, novos descontos financeiros ficam
          bloqueados.
        </p>
        {[
          ["admin_discount_bps", "Limite do administrador"],
          ["manager_discount_bps", "Limite do gerente"],
        ].map(([name, label]) => (
          <label className="field-label" key={name}>
            {label}
            <input
              className={control}
              name={name}
              type="number"
              min={0}
              max={10000}
              required
              defaultValue={
                policy?.value[
                  name as "admin_discount_bps" | "manager_discount_bps"
                ] ?? ""
              }
            />
          </label>
        ))}
      </CommandForm>
    </div>
  );
}
