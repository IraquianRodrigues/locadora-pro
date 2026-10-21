# Entrega da Fase 2 — 19/10/2026

## Implementado

- 12 migrations ordenadas em `supabase/migrations`, com 53 tabelas da aplicação e cinco views financeiras mínimas.
- UUIDs, FKs com índices, checks de dinheiro finito/positivo, datas/faixas, alvos exclusivos, placa/chassi/documentos únicos, CPF e CNPJ numérico/alfanumérico.
- RBAC com quatro papéis e 44 permissões; perfis novos inativos, negação por padrão, revogação por profile e proteção do último ADMIN.
- RLS e grants explícitos; ausência de privilégios anônimos nas tabelas brutas e EXECUTE revogado de PUBLIC nas funções da aplicação.
- Alocação central com GiST, locks e constraint triggers diferidos. Origens ocupantes exigem alocação correspondente; cancelamento libera no mesmo commit.
- Funções transacionais de aprovação, transição/cancelamento, bloqueio, prorrogação, recebimento explícito e gestão de acesso.
- Snapshots congelados, histórico, evidências concluídas e ledgers preservados; saldos e reembolsos/cauções protegidos por transação.
- Auditoria sanitizada, outbox, idempotência SHA-256 e tabelas preparadas para limiter/worker.
- Quatro buckets privados, políticas por vínculo de metadados e projeções de catálogo sem documentos/placa/observações internas.
- Configuração local Supabase, seed de desenvolvimento opt-in, suíte pgTAP e CI Supabase preparados.

Nenhum dado empresarial fictício foi inserido na aplicação ou em projeto remoto. As únicas linhas automáticas de migration são os papéis/permissões estruturais e a configuração de buckets. Fixtures de clientes/veículos/financeiro existem somente nos clusters descartáveis de teste.

## Arquivos principais

| Local                                                          | Conteúdo                                                |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| supabase/migrations/20261019000100_foundation.sql              | Extensão, validadores e helper de segurança             |
| supabase/migrations/20261019000200_identity_settings.sql       | Auth profile, RBAC e configurações                      |
| supabase/migrations/20261019000300_fleet.sql                   | Frota/categorias/documentos                             |
| supabase/migrations/20261019000400_customers.sql               | Clientes, condutores e notas                            |
| supabase/migrations/20261019000500_pricing.sql                 | Tarifas, regras, quotes e congelamento                  |
| supabase/migrations/20261019000600_reservations_rentals.sql    | Reservas/locações e relacionamentos                     |
| supabase/migrations/20261019000700_allocations.sql             | Alocações, bloqueios, manutenção e GiST                 |
| supabase/migrations/20261019000800_evidence.sql                | Contratos e vistorias                                   |
| supabase/migrations/20261019000900_finance.sql                 | Ledgers e limites financeiros                           |
| supabase/migrations/20261019001000_audit_outbox.sql            | Auditoria, outbox, idempotência e notificações          |
| supabase/migrations/20261019001100_transactional_functions.sql | Funções críticas com autorização e locks                |
| supabase/migrations/20261019001200_storage_projections.sql     | Storage, projeções e índices FK restantes               |
| tests/integration/database.mjs                                 | Testes de banco reais e concorrência                    |
| tests/integration/support/                                     | Fixtures e shim Auth/Storage exclusivamente de testes   |
| scripts/test-database.mjs                                      | Supervisor que exige recibo de sucesso da execução      |
| scripts/run-database-cluster.mjs                               | Criação/aplicação/teste/encerramento do cluster isolado |
| supabase/tests/database/001_security.test.sql                  | Suíte pgTAP para Supabase real/local                    |
| supabase/config.toml                                           | Stack local PostgreSQL 17 e cadastro público fechado    |
| supabase/seeds/development.sql                                 | Seed explícito e separado das migrations                |
| .github/workflows/database.yml                                 | Aplicação do zero, lint, pgTAP e geração de tipos no CI |

## Dependências

Adicionadas somente em devDependencies: `pg@8.23.1` e `embedded-postgres@18.4.0-beta.17`, com binário nativo PostgreSQL 18.4. Registro, engines, documentação e código do wrapper foram inspecionados; lockfile foi auditado antes da instalação, sem vulnerabilidades conhecidas. O wrapper beta é ferramenta de teste, não componente de produção. Não foram instalados Docker, CLI global, serviços do Windows nem usuários do sistema.

## Verificações

| Comando / cenário                                         | Resultado                                                                  |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| npm install --package-lock-only --ignore-scripts / npm ci | Árvore de testes instalada; auditoria sem vulnerabilidades na resolução    |
| npm run test:db                                           | 12 migrations aplicadas do zero e 17 cenários aprovados em PostgreSQL 18.4 |
| npm run lint                                              | Sem erros após corrigir preservação da causa de erro no runner             |
| npm run typecheck                                         | Sem erros TypeScript                                                       |
| npm test                                                  | 10 testes unitários existentes aprovados                                   |
| npm run build                                             | Build Next.js de produção aprovado                                         |
| npm run format:check                                      | Formatação verificada ao concluir a entrega                                |
| npm audit --audit-level=high                              | Zero vulnerabilidades conhecidas na árvore final                           |
| Supabase CLI / Docker / pgTAP da stack                    | Não executados neste ambiente: ferramentas/configuração não disponíveis    |
| CI no GitHub                                              | Workflow preparado; não houve execução remota                              |

Os 17 cenários cobrem: inventário de tabelas/RLS/grants; privilégios de funções; catálogo anônimo; matriz de perfis/revogação; documentos/valores/placas/tarifas; snapshots; aprovações simultâneas de veículo; capacidade por categoria/idempotência; bloqueios/manutenção/adjacência; estados inválidos; prorrogação com rollback; pagamentos concorrentes; reembolsos/cauções; vistoria imutável; seed opt-in; último ADMIN; Storage SQL e auditoria append-only.

O runner inicia múltiplas conexões reais e verifica conflitos PostgreSQL (`23P01`), permissões (`42501`), checks (`23514`) e idempotência (`23505`). Houve falhas iniciais de sintaxe, enumeração de tabelas e EXECUTE herdado de PUBLIC; foram corrigidas antes da execução aprovada. A supervisão também foi ajustada para impedir que o exit hook do wrapper ocultasse falhas como exit code zero.

## Dependências e limites pendentes

O [guia de configuração](setup.md) detalha a stack Supabase 17, aplicação local/remota, bootstrap ADMIN, variáveis, tipos oficiais e testes HTTP. O shim local não substitui Auth/JWT/PostgREST/Storage reais. Nenhum segredo foi solicitado ou exposto e nenhum banco externo foi alterado.

Não há endpoints HTTP novos de negócio nem formulários de login nesta fase. Solicitação pública, precificação completa, conversão/check-out/check-in, assinatura/PDF, worker de notificações, manutenção completa e operações financeiras adicionais serão implementados nas fases respectivas; não receberam uma API privilegiada incompleta. O painel permanece fechado.

Próximo passo: executar a validação específica do Supabase e gerar tipos oficiais; em seguida Fase 3 (Auth SSR, RBAC no servidor e proteção de entradas do aplicativo).
