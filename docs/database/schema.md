# Modelo de dados e plano de migrations

Fase 9: **25 migrations e 64 tabelas**. A migration 25 acrescenta índices de período/paginação e a RPC `operational_readiness()` restrita a service_role. Não cria tabelas nem reescreve histórico; detalhes e ensaio de homologação em [phase-9.md](../phase-9.md). As contagens anteriores abaixo são históricas.

Estado atual da Fase 8: **24 migrations e 64 tabelas**. A 21 acrescentou `rental_events` e `rental_charge_cancellations`. As 22–24 acrescentam `charge_adjustments`, `deposit_application_reversals`, `expense_reversals`, `maintenance_events`, `vehicle_status_events` e `notification_routes`, além de competência, revisões, snapshots/leases, RPCs financeiras/de manutenção e relatórios. Dicionário físico nos SQLs; definições, compatibilidade e homologação em [business-operations.md](../business-operations.md). As contagens por fase abaixo são históricas.

Atualização da Fase 6: **20 migrations e 56 tabelas**. A 19 acrescenta publicação/configuração/projeções de catálogo; a 20 acrescenta `public_booking_operations` e `public_reservation_submissions`, ownership/idempotência, termos aceitos e solicitação pública. RLS/grants e configuração em [public-site.md](../public-site.md). As descrições de entregas anteriores abaixo são históricas.

Atualização das Fases 3–5: há **18 migrations e 54 tabelas**. A 13 acrescenta sessão/RBAC Auth; 14/15 acrescentam integridade de cadastros, `branches.archived_at` e `registry_files`. As 16–18 acrescentam arquivamento tarifário, nome/limites gerados dos preços, versão/snapshots, origem única de cotação na reserva e funções comerciais/ocupação com intervalo operacional. O dicionário abaixo descreve a fundação da Fase 2. Revisão de legado em [registry.md](../registry.md) e alterações comerciais em [phase-5.md](phase-5.md).

**Schema implementado nas 12 migrations da Fase 2:** 53 tabelas com constraints, índices, RLS e funções transacionais de infraestrutura. A sequência foi aplicada do zero em PostgreSQL 18.4 isolado; ainda não em um projeto Supabase. O [ER](erd.md) resume o modelo; os SQLs são o dicionário físico autoritativo. Veja [setup e limites dos testes](setup.md), [políticas](policies.md) e [evidências](phase-2.md).

## Convenções

- UUID PK por padrão; `profiles.id` referencia `auth.users.id`. `created_at/updated_at timestamptz` nas entidades; ledgers/históricos mantêm ambos os campos, mas triggers recusam atualização/exclusão.
- Valores `numeric(12,2)` com checks >= 0; sinais financeiros representados por tipo/compensação, sem sobrecarregar coluna positiva.
- Datas civis como `date`; instantes como `timestamptz`; faixas efetivas `tstzrange` com limites `[)` e sem infinito.
- FKs explícitas e índices nos campos de referência consultados. deleções restritas por FKs (NO ACTION padrão ou RESTRICT explícito) em operações e histórico; cascatas apenas em filhos não históricos onde seguro.
- Documentos normalizados e validados, únicos onde aplicável. Soft delete para frota/categorias/clientes; dados financeiros e evidências não são apagados por CRUD.
- JSONB somente para snapshots, checklist e parâmetros tipados/versionados; não substitui relacionamentos, dinheiro ou estados fundamentais.
- Dados empresariais e pessoais separados de projeções públicas. `anon` não recebe SELECT amplo de `vehicles/customers/reservations`.
- `branches` permite unidades sem transformar o sistema em multiempresa. `company_settings` singleton e `system_settings` com chave única; edição só ADMIN.

## Sequência de migrations implementadas

As linhas abaixo descrevem as migrations originais 01–12. A 13 acrescenta Auth/sessões, 14/15 cadastros/arquivos e 16–18 o fluxo comercial. As 01–15 usam o prefixo `2026101900NN00`; 16–18 usam `2026102000NN00`. Após aplicar a um ambiente persistente compartilhado/produção, não editar esses arquivos: criar novas migrations.

| Ordem | Conteúdo                                                                            | Dependência      | Validação                                                   |
| ----- | ----------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------- |
| 01    | btree_gist, validadores, helper de RLS/grants e updated_at                          | Projeto Supabase | Extensões, search_path e privilégios                        |
| 02    | profiles, roles, permissions, user_roles, role_permissions, branches, configurações | 01, auth.users   | Revogação, último ADMIN, negação padrão                     |
| 03    | Categorias, veículos, imagens, documentos                                           | 02               | Placa/chassi únicos, km/ano/capacidade e projeções públicas |
| 04    | Clientes, condutores, documentos e notas                                            | 02               | CPF/CNPJ únicos normalizados, acesso documental             |
| 05    | Planos/preços/regras/adicionais, quotes/quote_items                                 | 03/04            | Vigência, alvo exclusivo, precisão e snapshot               |
| 06    | Reservas/itens/histórico, locações/condutores/extensões/logística                   | 03–05            | Transições, datas, conversão única, responsáveis            |
| 07    | Bloqueios, manutenção, alocações e exclusão GiST                                    | 03/06            | Conflitos entre TODOS os tipos, adjacência                  |
| 08    | Templates/contratos, vistorias/itens/fotos/danos                                    | 06               | Versão única, imutabilidade de conclusão, vínculos          |
| 09    | charges/payments/allocations/deposits/refunds/expenses                              | 06/07            | Saldos, idempotência, compensações e locks                  |
| 10    | notifications/templates/outbox/audit, idempotência e rate limits                    | 02–09            | Outbox atômica, retries, retenção e PII                     |
| 11    | RPCs de aprovação/transição/bloqueio/prorrogação/recebimento/acesso                 | 01–10            | Concorrência real em conexões distintas                     |
| 12    | Buckets/policies Storage e projeções de catálogo/financeiro                         | 03–11            | Anônimo, perfis, token, URLs e minimização                  |

RLS, grants, índices e checks de cada tabela entram **no mesmo arquivo que a tabela**, inclusive enquanto RPCs ainda não existem (negação padrão). Catálogo RBAC é seed estrutural de migration; dados fictícios só em `supabase/seeds` de desenvolvimento, com ativação explícita, sem detectar automaticamente produção. Dados reais da empresa não são seed genérico.

## Alocação central

`vehicle_allocations` tem veículo, período, tipo, referência explícita exclusiva (`reservation_id`, `rental_id`, `vehicle_block_id` ou `maintenance_record_id`), criação/responsável e liberação. CHECK garante exatamente uma origem conforme tipo. Índices UNIQUE parciais impedem ocupações duplicadas para a mesma origem. Conversão troca a origem em transação.

Restrição implementada e exercitada em testes reais de concorrência:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.vehicle_allocations
  ADD CONSTRAINT vehicle_allocations_no_overlap
  EXCLUDE USING gist (vehicle_id WITH =, period WITH &&)
  WHERE (released_at IS NULL);
```

CHECK adicional exige `NOT isempty(period)`, limites finitos, `lower(period) < upper(period)` e `[)`. Bloqueios e manutenção **não** criam uma segunda fonte independente de disponibilidade; a alocação é obrigatória se bloquearem operação. Veículo INACTIVE/MAINTENANCE/RETIRED não pode receber nova alocação comercial; a RPC verifica estado sob lock.

Erros de exclusão (`23P01`) viram 409, sem detalhes internos. Locks seguem ordem padronizada: idempotência → reserva/locação → categoria quando necessária → veículos em ordem de UUID → alocações → financeiro. Retentar deadlock/serialization de forma limitada com idempotência.

## Contratos e integridade

- Reserva referencia quote; o snapshot aprovado fica versionado. `reservation_items` tem apenas um item no MVP; veículo efetivamente atribuído está em alocação e locação.
- `rentals.reservation_id` é opcional e UNIQUE; check-out/check-in só por RPC com auditoria.
- `contract_templates` tem chave/versão únicas; `contracts` referencia template e locação, versão, hash, caminho privado e snapshot. Regenerar cria versão.
- `inspection_templates` versiona checklist configurável; `inspections` copia checklist aprovado, `inspection_items` e fotos são evidências imutáveis após conclusão.
- `payments` exige confirmado por/data para estado confirmado; `payment_allocations` trava saldo e cobrança; triggers/RPC impedem somas maiores que principal. Compensações ficam ligadas ao lançamento original.
- `refunds` referencia pagamento ou caução com XOR; valor acumulado reembolsado não ultrapassa saldo liberável. Despesas de manutenção podem referenciar veículo e manutenção, sem somar duas vezes nos relatórios.
- `audit_logs` é append-only, restrito por domínio; snapshots de auditoria excluem segredos/documentos completos. Outbox evita PII em payload preferindo IDs.

## Índices mínimos

UNIQUE placa normalizada, chassi informado, CPF/CNPJ normalizado, permissões/cargos por chave e pares de junção; índices por `(status, start_at, id)` em reservas/locações, `(customer_id, created_at)`, `(vehicle_id, occurred_at)` em manutenção, `(due_at)` em charges, cujo saldo é derivado do ledger, `(confirmed_at, id)` em payments, `(status, available_at)` em outbox e GiST nas alocações. Medir EXPLAIN nas consultas reais antes de adicionar índices adicionais.

## Teste e promoção

Banco local descartável: aplicar do zero, rodar testes SQL/RLS, executar suite de integração com múltiplas conexões e comparar tipos gerados. Reaplicar do zero em CI. Homologação usa projeto distinto; produção recebe somente migrations novas, backup e plano de recuperação (preferir forward fix). Nunca executar reset em produção.
