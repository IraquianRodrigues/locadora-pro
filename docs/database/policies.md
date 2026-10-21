# Políticas e integridade — Fases 2–8

Fase 8: todas as 64 tabelas da aplicação têm RLS. Novos ledgers e eventos não têm escrita direta de funcionários. Financeiro usa RPCs com sessão/permissão atual, idempotência, locks e validação de saldo inclusive nas RPCs antigas; manutenção compartilha exclusão de ocupação. Relatórios autorizam por domínio e a exportação é auditada. Caixa IN_APP exige destinatário próprio e permissão ainda válida; emails e outbox são internos, com claim/finish exclusivos de service_role. Views mínimas mantêm checagem explícita de `finance.read` e não autorizam tabelas de PII ao FINANCE. Os helpers internos não têm EXECUTE público; o helper da view financeira verifica permissão antes de acessar o saldo. Detalhes e limites em [business-operations.md](../business-operations.md). As seções abaixo descrevem a evolução histórica da fundação.

Fase 6: migrations 19/20, projeções públicas allowlist sujeitas à publicação, flags privadas por padrão, RPCs de gravação/ownership somente service_role e intake sob RLS de reservas + clientes. Não há escrita anônima direta nem sobrescrita de cliente existente. O backend verifica Origin, cookie assinado, quotas e Turnstile antes de chamar a RPC; o banco confere negócio, ownership, aceite e snapshot. Ver [public-site.md](../public-site.md).

Na Fase 5, migrations 16–18 implementaram contexto/fingerprint e cotação confiável, solicitação/decisão com versão, ocupação com intervalo após devolução e expiração/token mínimo. Quotes/itens agora exigem pricing.read **e** reservations.read. Política tarifária tem histórico sem UPDATE de funcionários. Persistência de totais, expiração e consulta por token são RPCs exclusivas de service_role e passam pelo backend autorizado/limitado. Nenhuma função de escrita confiável pode ser concedida a anon/authenticated. Detalhes em [reservations.md](../reservations.md).

Na Fase 4, migrations 14/15 acrescentaram integridade de cadastros e `registry_files` (54ª tabela), com SELECT por permissão e sem escrita direta de funcionários. A RPC de arquivamento de arquivo exige permissão e sessão; o pipeline privilegiado é delimitado pelo servidor. Arquivos novos prevalecem na checagem Storage e precisam estar READY. INSERT direto de funcionários nos buckets de fotos/documentos dos cadastros foi negado, inclusive ADMIN. Procedimento completo em [registry.md](../registry.md).

Na Fase 3, a migration 13 passou a exigir sessão existente em `auth.sessions`, vinculada a `auth.uid()`/`auth.jwt().session_id` e não expirada por `not_after`, inclusive nas policies próprias de perfil/notificação. Perfil/cargo/permissões continuam consultados no banco. `staff_context()` retorna apenas a identidade atual, sem parâmetro de usuário. `consume_auth_limit` é exclusivo de service_role; `record_auth_event` registra somente eventos próprios allowlist de sessões ativas. Configuração e homologação em [Auth](../authentication.md).

## Privilégios

Todas as 53 tabelas têm RLS. `anon` não possui privilégios nas tabelas brutas. `authenticated` só recebe SELECT com policies baseadas em permissões atuais; perfil inativo ou sem papel não vê registros. INSERT/UPDATE são concedidos somente aos CRUDs de configuração/cadastro indicados abaixo. DELETE não é concedido. Operações de ciclo de vida e lançamentos financeiros passam por funções transacionais; não existe PATCH genérico de status.

`service_role` recebe acesso privilegiado e bypassa RLS, como no Supabase. Seu uso exige processo de servidor confiável. Nenhuma policy consegue conter uma chave de serviço exposta: o app mantém o isolamento já documentado.

| Grupo                                  | Leitura                                             | Escrita de authenticated                                         |
| -------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| Perfis                                 | Próprio perfil ativo; ADMIN lê equipe               | Apenas set_staff_access; sem autoedição de active/cargo          |
| Papéis/permissões/junções              | users.manage                                        | Catálogo por migrations; atribuição de cargo por RPC             |
| Unidades/empresa/sistema               | operations.read ou settings.manage conforme tabela  | settings.manage                                                  |
| Categorias/frota/imagens               | categories.read ou vehicles.read                    | categories.write ou vehicles.write                               |
| Clientes/notas/condutores              | customers.read ou drivers.read                      | customers.write ou drivers.write; autoria da nota validada       |
| Documentos pessoais e de veículo       | documents.read                                      | documents.write; acesso aos arquivos também exige Storage        |
| Tarifas/regras/adicionais              | pricing.read                                        | pricing.write em planos/preços/adicionais; regras só por trigger |
| Orçamentos/itens                       | pricing.read e reservations.read                    | Sem escrita direta; RPC confiável exclusiva de backend           |
| Reservas/itens/histórico/logística     | reservations.read                                   | Aprovação/transição por RPC; solicitação pública ainda fechada   |
| Locações/condutores/aditivos/logística | rentals.read                                        | Prorrogação por RPC; conversão/check-out/check-in na Fase 7      |
| Alocações/bloqueios/manutenção         | vehicles.read ou maintenance.read                   | Bloqueio por RPC; manutenção completa na Fase 8                  |
| Contratos/vistorias/danos              | contracts.read ou inspections.read                  | Sem escrita direta; serviços das fases correspondentes           |
| Financeiro                             | finance.read                                        | Recebimento explícito por RPC; demais serviços na Fase 8         |
| Auditoria                              | Separada em OPERATIONS/FINANCE/ACCESS por permissão | Trigger definer append-only; sem alteração/exclusão              |
| Outbox/idempotência/rate limit         | Sem leitura de funcionário                          | Processos/funções privilegiados                                  |
| Notificações                           | Próprio destinatário ativo                          | Worker                                                           |

O FINANCE lê dados mínimos em `finance_customers`, `finance_vehicles`, `finance_reservations` e `finance_contracts`. Não há concessão de customers.read/vehicles.read/documents.read ao FINANCE. As views usam security_barrier e checagem explícita de finance.read, pois RLS por linha não oculta colunas. `finance_charge_balances` calcula saldo a partir dos ledgers; recebimentos e cauções não são confundidos.

As únicas funções anônimas são `catalog_categories` e `catalog_vehicles`: projeções explícitas sem placa/chassi/documentos/notas/tokens. Não representam consulta definitiva de disponibilidade nem orçamento. O catálogo HTTP será integrado na Fase 6.

## Funções transacionais disponíveis no banco

| Função                 | Permissão            | Garantias                                                                                                                      |
| ---------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| approve_reservation    | reservations.approve | Reserva sob lock, quote válido/congelado, veículo ativo, atribuição por categoria/unidade, GiST, histórico/outbox/idempotência |
| transition_reservation | Conforme transição   | Lista fechada de destinos, motivo, estado anterior validado e liberação atômica no cancelamento                                |
| create_vehicle_block   | blocks.write         | Bloqueio e alocação na mesma transação, exclusão comum                                                                         |
| extend_rental          | rentals.extend       | Quote adicional congelado, novo fim validado, conflito desfaz alocação/datas/aditivo/outbox                                    |
| confirm_charge_payment | payments.confirm     | received=true explícito, valor decimal, meio ativo, ledger e alocação atômicos, proteção contra excesso e idempotência         |
| set_staff_access       | users.manage         | Permissões atuais, lock de acesso, preservação do último ADMIN                                                                 |

EXECUTE em funções da aplicação é revogado explicitamente de PUBLIC. As funções definer usam search_path vazio e referências qualificadas. A função has_permission só consulta a identidade `auth.uid()`; ninguém informa outro usuário para elevar privilégios. RPCs públicas de solicitação, consulta por token, conversão, check-out/check-in, reembolsos e worker não foram expostas antecipadamente: dependem dos serviços, regras e validações das fases correspondentes.

## Constraints e triggers

- Tipos, checks de valores finitos/não negativos, documentos normalizados válidos (CPF e CNPJ numérico/alfanumérico), placa/chassi únicos, datas e capacidades.
- Preços têm alvo XOR e exclusão de vigência por plano/alvo. Plano mensal exige modo calendário/comercial explícito; dias comerciais só no modo correspondente.
- Quote congelado tem itens e total consistente, com itens DISCOUNT subtraídos. Snapshot e itens congelados não podem ser reescritos; calculadora implementada na Fase 5.
- Alocações finitas `[)` têm uma única origem compatível com o tipo. A exclusão GiST protege todos os tipos de ocupação. Constraint triggers diferidos exigem alocação exata para fontes ocupantes e ausência para fontes liberadas, com veículo/período/alvo correspondentes.
- Reserva exige um item; reserva/quote têm cliente e período correspondentes. Uma reserva origina no máximo uma locação. Condutor/locação pertencem ao mesmo cliente por FKs compostas.
- Máquina de estados protege reservas/locações. Pré-condições comerciais de retirada e fechamento são implementação da Fase 7; não há RPC de retirada liberada nesta fase.
- Vistorias concluídas, itens/fotos, contratos gerados, templates contratuais, histórico e aditivos são preservados. Novas versões substituem edição do passado.
- Pagamentos, alocações, cobranças, cauções, reembolsos e despesas são imutáveis. Compensações são novas linhas; saldo de cobrança desconta pagamentos/cauções e considera reembolso de alocação. Reembolso sem alocação só consome saldo não alocado.
- O ledger usa advisory lock financeiro global conservador para evitar write-skew entre caução/pagamento/reembolso. Isso prioriza correção no MVP; medir antes de particionar locks por origem. Testes com duas conexões verificam a disputa de saldo.
- Auditoria grava somente IDs, ator, domínio, operação e correlação; não copia registros com CPF/CNH/documentos. Corpos de eventos contêm IDs. Idempotência verifica hash SHA-256 do payload e guarda apenas resposta segura.
- FKs têm índices de suporte; índices de status/período/alertas/outbox complementam os de unicidade e GiST. Nenhuma coluna tenant_id foi introduzida.

As migrations não contém cláusulas jurídicas nem preços reais. Regras comerciais pendentes continuam no ADR/backlog.
