# API da Fase 8

Base `/api/v1`. Sessão Supabase da equipe, perfil ativo, cargo e sessão atuais são obrigatórios. JSON estrito, limite de corpo de 64 KiB, respostas privadas `no-store`, erros sanitizados com requestId. Mutações exigem Origin da aplicação. Sem Supabase configurado, acesso falha fechado. O documento [business.openapi.yaml](business.openapi.yaml) descreve os endpoints; schemas estruturais são [gerados dos validadores Zod](business.schemas.json) com `node scripts/generate-business-api.mjs` em Node 24.

Refinamentos de soma, unicidade, origem exclusiva, datas ordenadas e saldos dependem dos validadores/SQL além do JSON Schema gerado. Campos extras de cada comando são recusados. Os arquivos fonte em `src/lib/finance/schema.ts`, `src/lib/maintenance/schema.ts`, `src/lib/reports/schema.ts` e as migrations são a referência executável.

## Endpoints

| Método/rota                    | Contrato                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/admin/finance`           | `kind=CHARGES                                                                                                                           | PAYMENTS | DEPOSITS | REFUNDS | EXPENSES | ADJUSTMENTS`(padrão CHARGES),`page=1..10000`, `customer`/`rental`UUID opcionais. Despesas não aceitam esses vínculos como filtros. Retorna`{rows,total,page,page_size:20}`. Exige `finance.read`. |
| POST `/admin/finance`          | Envelope de comando financeiro; 201 com `{data:{id}}`. Permissão específica por ação e `finance.read` no banco.                         |
| GET `/admin/maintenance`       | `page`, `status` opcional SCHEDULED/IN_PROGRESS/COMPLETED/CANCELLED. `{rows,total,page}` com 20 itens, `maintenance.read`.              |
| POST `/admin/maintenance`      | Envelope de comando de manutenção (CREATE ou transições), `maintenance.write` e leitura no banco. 201 com `{data:{id,version,status}}`. |
| GET `/admin/maintenance/:id`   | `{record,events}`; `maintenance.read`, UUID validado e 404 se ausente.                                                                  |
| PATCH `/admin/maintenance/:id` | Envelope de transição; `input.maintenance_id` deve ser o mesmo UUID da URL. CREATE não é aceito. 200 com `{data:{id,version,status}}`.  |
| GET `/admin/dashboard`         | `from`/`to` YYYY-MM-DD, padrão mês corrente até hoje. `{operations?,finance?}`, somente domínios autorizados.                           |
| GET `/admin/reports`           | `kind`, `from`, `to`, `page` (padrão 1), `page_size=1..100` (padrão 50). `{rows,total,page,page_size,kind}`. Autorização pelo tipo.     |
| GET `/admin/reports/export`    | Mesmos filtros. CSV somente da página, attachment, autorização e auditoria; até 10 exportações/janela de 15 minutos por funcionário.    |

UUIDs, dinheiro e datas não são inferidos pelo cliente. Dinheiro de entrada é string positiva com até duas casas; vírgula decimal simples é normalizada, sem separador de milhar. O servidor envia BRL canônico de duas casas para SQL. Saídas monetárias permanecem strings. Instantes são ISO 8601 com Z ou offset. Datas civis dos relatórios são inclusivas no fuso da aplicação, até 366 dias.

## Envelope e idempotência

```json
{
  "idempotency_key": "<chave-aleatoria-unica-de-16-a-200-caracteres>",
  "input": {
    "action": "PAYMENT",
    "customer_id": "<uuid-do-cliente>",
    "payment_method_id": "<uuid-do-meio-ativo>",
    "amount": "150.00",
    "received": true,
    "allocations": [{ "charge_id": "<uuid-da-cobranca>", "amount": "100.00" }]
  }
}
```

Reutilizar chave **e payload idênticos** após timeout; não gerar nova chave até conhecer o resultado. Chave reutilizada com payload divergente produz conflito. Chaves são vinculadas ao ator/operação pelo banco. Mudar o conteúdo depois de uma falha de validação requer nova tentativa/chave. A UI mantém a chave da tentativa ao repetir conteúdo idêntico.

## Comandos financeiros

Todos exigem `action` e `amount`. Motivo/descrição: 5–1000 caracteres. UUIDs opcionais devem ser enviados explicitamente como null quando presentes no schema.

| Ação / permissão                    | Campos adicionais                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHARGE / `charges.create`           | `customer_id`, `rental_id` nullable, `kind=MANUAL                                                                                                       | FINE`, `due_at`, `competence_at`, `description`. Locação deve corresponder ao cliente e não estar cancelada. |
| PAYMENT / `payments.confirm`        | `customer_id`, `payment_method_id`, `received:true`, `allocations` array de 0–50 `{charge_id,amount}`, únicas, soma <= recebimento e mesmo cliente.     |
| ALLOCATE / `payments.confirm`       | `payment_id`, `charge_id`. Limita crédito livre e saldo da cobrança, mesmo cliente.                                                                     |
| DEPOSIT_RECEIVE / `deposits.manage` | `rental_id`, `payment_method_id`, `received:true`; locação aberta.                                                                                      |
| DEPOSIT_APPLY / `deposits.manage`   | `deposit_id` RECEIVED, `charge_id`, `reason`; mesma locação.                                                                                            |
| DEPOSIT_UNAPPLY / `deposits.manage` | `application_id` APPLIED, `reason`. Compensação limitada ao saldo aplicado.                                                                             |
| REFUND / `refunds.create`           | `payment_id` XOR `deposit_id`, outro null; `allocation_id` nullable somente para pagamento; `payment_method_id`, `paid_out:true`, `reason`.             |
| ADJUST / `charges.create`           | `charge_id`, `kind=DISCOUNT                                                                                                                             | CANCEL                                                                                                       | CORRECTION`, `reason`. Desconto exige também `discounts.authorize`e limite acumulado do cargo; demais créditos exigem`refunds.create`. |
| EXPENSE / `expenses.write`          | `vehicle_id` nullable, `maintenance_id` nullable correspondente ao veículo, `occurred_at`, `payment_method_id`, `paid:true`, `description`. Não futura. |
| EXPENSE_REVERSE / `expenses.write`  | `expense_id`, `confirmed:true`, `reason`. Compensação limitada ao original.                                                                             |

Nenhum comando aceita dados sensíveis de cartão, status arbitrário ou valor negativo para simular estorno. A confirmação é manual e não movimenta dinheiro em terceiros.

## Comandos de manutenção

CREATE exige `vehicle_id`, `kind=PREVENTIVE|CORRECTIVE|OIL|TIRES|SERVICE`, `mileage`, `start_at`, `end_at`, `blocks_availability` boolean explícito e `description` (5–2000). Os demais comandos exigem `maintenance_id` e `expected_version` inteiro positivo:

| Ação       | Campos/regras adicionais                                                                                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| START      | Agenda ainda não iniciada, dentro da janela e sem locação física incompatível.                                                                                                                                       |
| RESCHEDULE | `start_at`, `end_at`; somente SCHEDULED e sem conflito.                                                                                                                                                              |
| EXTEND     | `end_at` posterior ao fim atual e agora; somente IN_PROGRESS.                                                                                                                                                        |
| COMPLETE   | `mileage`, `next_due_on` nullable, `next_due_mileage` nullable >= km atual, `expense` nullable. Despesa opcional `{amount,occurred_at,description,payment_method_id,paid:true}` exige também autorização financeira. |
| CANCEL     | `reason` mínimo 5 caracteres; preserva histórico e libera ocupação.                                                                                                                                                  |

Não há DELETE de histórico. Falha em despesa ou conflito desfaz a operação inteira. Quilometragem é inteira e crescente. Próxima data é civil; alertas usam `company_settings.timezone`, alinhado ao `APP_TIMEZONE` da aplicação.

## Relatórios e worker

Tipos financeiros: REVENUE, RECEIPTS, EXPENSES, PROFITABILITY, BALANCES (`reports.finance`). Operacionais: RESERVATIONS, OCCUPANCY, RECURRING, OVERDUE, MAINTENANCE (`reports.operations`). Definições e limitações em [business-operations.md](../business-operations.md).

O endpoint interno é **fora da base /api/v1**: `POST /api/internal/business-jobs`, sem corpo, Bearer `OPERATIONS_JOBS_SECRET` de pelo menos 32 caracteres, somente servidor/agendador. Retorna contadores `{overdue,expired,maintenance_alerts,completed,failed,deliveries,email_configured,sent,email_failed}`. `sent` representa aceitação confirmada pelo provedor, não entrega final. Sem segredo responde 503; credencial incorreta 401. O processamento manual no painel exige ADMIN e Origin válido.

Configurações de meios/limites, templates/rotas/retry e leitura da caixa usam Server Actions autenticadas, com validação de Origin e RPCs autorizadas; não existem endpoints públicos equivalentes. Jobs usam service role no servidor. A ausência de provedor preserva a fila EMAIL sem claim, enquanto IN_APP continua funcionando.
