# Catálogo REST planejado

Fase 6 entregue em [public.openapi.yaml](public.openapi.yaml): session, categories, vehicles/lista/detalhe, images, quotes, reservations e status. Disponibilidade indicativa acompanha a cotação; não há `/public/availability` separado. As tabelas abaixo mantêm a referência inicial, não são o contrato efetivo. Server Actions publicam configuração e fotos com sessão/RBAC.

Prefixo `/api/v1`. Auth e CRUD das Fases 3/4 estão entregues. A Fase 5 acrescenta rate-plans/prices/services ao CRUD, POST de quotes/availability/reservations, GET de quotes/reservations, PATCH de decisão com versão, POST de expiração e GET de status público por token. Contratos efetivos em `registry.openapi.yaml` e `commercial.openapi.yaml`. A tabela abaixo é referência das fases futuras; aprovar/rejeitar/cancelar usa o comando PATCH documentado, sem endpoints /approve etc. Dashboard/gestão de acessos usam Server Components/Actions. Sem webhook até integração definida.

## Público — Fases 5/6

| Método | Caminho                         | Entrada / controle                                      | Saída                                                      |
| ------ | ------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| GET    | /public/categories              | filtros e paginação                                     | Projeção de categorias ativas                              |
| GET    | /public/vehicles                | categoria, busca, período opcional                      | Catálogo sanitizado paginado                               |
| GET    | /public/vehicles/:id            | UUID                                                    | Detalhe público                                            |
| GET    | /public/availability            | início/fim com offset e alvo                            | Disponibilidade indicativa                                 |
| POST   | /public/quotes                  | período, alvo, serviços e logística                     | Snapshot, itens, total/caução decimal e validade           |
| POST   | /public/reservations            | quoteId, cliente, logística, antispam e Idempotency-Key | Referência, REQUESTED e token de consulta entregue uma vez |
| GET    | /public/reservations/:id/status | Token seguro por cabeçalho, não só UUID                 | Estado mínimo; inválido/expirado sem enumeração            |

## Administrativo — Fases 3–8

Todas exigem sessão validada, perfil ativo, permissão específica, RLS e `private, no-store`. Mutações validam Origin e idempotência nos casos críticos.

| Métodos    | Caminho                                       | Permissão / regra                                     |
| ---------- | --------------------------------------------- | ----------------------------------------------------- |
| GET        | /admin/dashboard                              | Escopo operacional/financeiro conforme perfil         |
| GET, POST  | /admin/vehicles                               | vehicles.read / vehicles.write                        |
| GET, PATCH | /admin/vehicles/:id                           | Validação, unicidade e arquivamento lógico            |
| GET, POST  | /admin/categories                             | categories.read / categories.write                    |
| PATCH      | /admin/categories/:id                         | Não apagar referências históricas                     |
| GET, POST  | /admin/customers                              | customers.read / customers.write                      |
| GET, PATCH | /admin/customers/:id                          | Minimização por perfil                                |
| GET        | /admin/reservations e /admin/reservations/:id | reservations.read                                     |
| POST       | /admin/reservations/:id/approve               | reservations.approve; RPC transacional                |
| POST       | /admin/reservations/:id/reject                | reservations.approve; motivo                          |
| POST       | /admin/reservations/:id/cancel                | Permissão conforme estado; liberar alocação           |
| GET, POST  | /admin/rentals                                | rentals.read / rentals.create                         |
| GET        | /admin/rentals/:id                            | rentals.read                                          |
| POST       | /admin/rentals/:id/check-out                  | rentals.checkout; pré-condições configuradas          |
| POST       | /admin/rentals/:id/check-in                   | rentals.checkin; vistoria/fechamento                  |
| POST       | /admin/rentals/:id/extensions                 | rentals.extend; conflito e aditivo                    |
| POST       | /admin/inspections                            | inspections.write; checklist e vínculo                |
| GET, POST  | /admin/charges                                | finance.read / charges.create                         |
| POST       | /admin/payments                               | payments.confirm; confirmação explícita e idempotente |
| GET, POST  | /admin/maintenance                            | maintenance.read / maintenance.write                  |
| GET        | /admin/reports/revenue                        | reports.finance; competência e recebido separados     |
| GET        | /admin/reports/occupancy                      | reports.operations; período                           |
| GET        | /admin/reports/vehicles                       | reports.operations/finance conforme campos            |
| GET, POST  | /admin/users                                  | users.manage; sem autoelevação                        |

CRUDs auxiliares futuros serão especificados antes de suas fases. API nunca aceita atualização livre de status. O PATCH de reservas é um comando restrito com target enumerado, expected_version, motivo e chave de idempotência; a RPC confere a máquina de estados.

## Convenções de contrato

- Sucesso `{ data, meta? }`; listagens usam `meta: { page, pageSize, total }`, page >= 1, pageSize 1–100 e desempate por ID. Filtros permitidos e sort são allowlists.
- Dinheiro em string decimal BRL (ex.: `"125.90"`), instantes ISO 8601 com offset, datas civis YYYY-MM-DD. UI formata pt-BR.
- Erro `{ error: { code, message, requestId } }`. 400 INVALID_REQUEST; 401 UNAUTHORIZED; 403 FORBIDDEN; 404 NOT_FOUND; 409 CONFLICT; 422 BUSINESS_RULE_VIOLATION; 429 RATE_LIMITED com Retry-After; 500 INTERNAL_ERROR sem stack.
- Token público inválido retorna resposta uniforme sem confirmar existência. Limites e retenção de idempotência são configurados por operação.
- Schemas de entrada recusam campos extras sensíveis; handlers não repassam objetos do navegador diretamente ao repository.
