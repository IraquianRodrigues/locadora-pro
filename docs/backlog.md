# Backlog e critérios de aceite

Prioridades: P0 integridade/segurança e fluxo principal, P1 operação completa, P2 evolução. Status por item: concluído somente com evidência em `verification.md`; planejado não significa implementado.

| Fase | Escopo                                                            | Dependências                        | Critério de saída                                          |
| ---- | ----------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| 0    | Diagnóstico, arquitetura, ER, fluxos, RBAC, migrations e decisões | Repositório e ferramentas           | Documentação revisada e coerente com escopo                |
| 1    | Next/TS, Tailwind/shadcn, layouts, Supabase env, qualidade e CI   | Node/npm e rede para pacotes        | Build, lint/types, testes da fundação; sem dados fictícios |
| 2    | Banco e RLS                                                       | Supabase/Docker, decisões de schema | Reset local reproduzível, policies e constraints testadas  |
| 3    | Auth e autorização                                                | Fase 2                              | Login/logout/recuperação, revogação e negação por perfil   |
| 4    | Frota/categorias/clientes/condutores                              | Fase 3                              | CRUD real, validação brasileira e Storage autorizado       |
| 5    | Tarifas/disponibilidade/reservas                                  | Fase 4 e políticas comerciais       | Cotação determinística e concorrência protegida por SQL    |
| 6    | Site público completo                                             | Fase 5 e dados da empresa           | Reserva real com token seguro e antispam                   |
| 7    | Locações/logística/vistorias/PDF                                  | Fase 5 e regras de retirada         | Ciclo completo, evidências e aditivos sem conflito         |
| 8    | Financeiro/manutenção/relatórios/notificações                     | Fase 7 e worker                     | Saldos consistentes, exportação real e retries             |
| 9    | Revisão, desempenho, deploy e homologação                         | Fases anteriores                    | Matriz de aceite e ensaio operacional assinados            |

## Itens detalhados

### Fase 0 — P0

- [x] Inspecionar diretório, instruções, versões, Git e disponibilidade de banco.
- [x] Propor arquitetura, árvore final e limites dos módulos.
- [x] ER com todas as entidades principais, fluxos de reserva/locação e estados.
- [x] Planejar migrations, proteção concorrente, permissões e pendências.
- [x] Definir primeira implementação e critérios de verificação.

### Fase 1 — P0

- [x] Inicializar dependências estáveis compatíveis e lockfile.
- [x] TypeScript strict, ESLint flat config, Prettier, Tailwind e shadcn locais.
- [x] Layouts responsivos, foco visível, skip link, estados de erro/carregamento.
- [x] Clientes Supabase por contexto, validação de env e exemplo sem segredo.
- [x] Painel negado até Auth; nenhuma rota de negócio simulada.
- [x] Vitest e Playwright para limites da fundação; CI com build e auditoria (workflow ainda não executado no GitHub).
- [x] Registrar comandos, resultados, limitações e próxima fase.

### Fase 2 — P0

- [x] 12 migrations e 53 tabelas conforme schema.md; PK/FK/checks/índices/timestamps.
- [x] RBAC, perfil ativo, grants mínimos, RLS em toda tabela exposta.
- [x] Exclusion constraint comum a reservas, locações, bloqueios e manutenção.
- [x] Funções transacionais de infraestrutura com search_path fixo e grants restritos; fluxos completos seguem nas fases de negócio.
- [x] Storage privado e policies por vínculo; projeções públicas mínimas (verificação SQL; HTTP Storage pendente).
- [x] Seed dev com ativação explícita, recusado sem configuração; catálogo estrutural separado de dados fictícios. A trava não identifica sozinha um banco de produção.
- [x] Workflow Supabase preparado para reaplicar migrations, pgTAP e gerar tipos; ainda não executado no GitHub.
- [x] Testes SQL de integridade, RLS e transações com sessões concorrentes em PostgreSQL 18.4 isolado.
- [ ] Validar a stack Supabase/PostgreSQL 17, executar pgTAP/lint e gerar tipos oficiais para os clientes.
- [ ] Testar JWT/PostgREST e upload/URLs no Storage real após configuração; não cobertos pelo shim de teste.

As entregas de código da Fase 2 estão prontas para essa validação; aplicação remota, tipos oficiais e homologação dependem dos itens acima. Procedimento em `docs/database/setup.md`.

### Fase 3 — P0

- [x] Login/logout, recuperação e atualização de senha com callbacks seguros; adapters testados, HTTP Auth real pendente.
- [x] SSR refresh de cookies, rotas dinâmicas sem cache, proteção por entrada; proxy testado com adapters.
- [x] Bootstrap ADMIN documentado, gestão de acessos e revogação; preservar último ADMIN. Criação de contas via Supabase administrativo.
- [x] RBAC em páginas, API, ações e RLS; testes de bypass de UI e API fechada sem configuração.
- [x] Eventos de acesso sanitizados, limites distribuídos atômicos, respostas sem enumeração por conteúdo.
- [x] Dashboard base com contagens reais; visão operacional/financeira por perfil, sem dados fabricados.
- [ ] Homologar login, refresh, logout, links recovery/SMTP, cookies HTTPS, PostgREST/Storage e sessões revogadas no Supabase real; gerar tipos oficiais.

Procedimento e limites da evidência em `authentication.md`. A implementação da Fase 3 está pronta para essa homologação; não foi aplicada a projeto remoto.

### Fase 4 — P0/P1

- [x] Categorias configuráveis com capacidade, características e ativo/inativo.
- [x] Veículos com todos os campos, placa/chassi/RENAVAM únicos, filtros e paginação.
- [x] Histórico consultado de uso/manutenção, arquivamento e restauração sem apagar referências.
- [x] Clientes PF/PJ, CPF/CNPJ numérico/alfanumérico válidos/normalizados e endereço brasileiro.
- [x] Condutores separados, CNH/validade/categoria e vínculo com cliente; conferência documental não é consulta ao DETRAN.
- [x] Uploads com tipo/tamanho/conteúdo validados, imagens sem EXIF e emissão autorizada de URL temporária; HTTP Storage real pendente.
- [x] Testes SQL de CRUD persistente, duplicidade, concorrência de edição e acesso documental por cargo; testes unitários de serviço/conteúdo.
- [ ] Homologar interface autenticada, REST/Storage/URLs assinadas na stack real; executar pgTAP/PostgreSQL 17 e gerar tipos.
- [ ] Sanear/validar constraints NOT VALID de legado e configurar retenção/reconciliação e tratamento de PDFs antes do uso comercial.

Código da Fase 4 pronto para homologação conforme `registry.md`. Unidades incluídas como pré-requisito da frota; nenhum seed ou dado remoto foi criado.

### Fase 5 — P0

- [x] Tarifas diária/semanal/mensal e precedência veículo/categoria/vigência.
- [x] Mês calendário/comercial, horas, tolerância, pacotes e arredondamento configuráveis.
- [x] Adicionais, logística, descontos autorizados, caução e snapshots imutáveis.
- [x] Consulta indicativa de disponibilidade e ocupação central com intervalo operacional.
- [x] Solicitação REQUESTED, histórico, revisão, aprovação/rejeição/cancelamento/expiração por RPC.
- [x] Aprovação de categoria atribui veículo sob lock, RPC atômica e outbox.
- [x] Idempotência e token de consulta com hash/validade, endpoint mínimo com limite distribuído.
- [x] Testar simultaneidade, adjacência, estados inválidos e alteração de tarifa no PostgreSQL isolado.
- [ ] Homologar PostgreSQL 17/pgTAP, JWT/PostgREST, telas autenticadas e gerar tipos oficiais.
- [ ] Definir tarifas/políticas reais, retenção e job de expiração; configurar worker de comunicação na Fase 8.

Código da Fase 5 pronto para homologação conforme [reservations.md](reservations.md). 18 migrations, 96 testes unitários, 39 cenários SQL e 26 E2E de fronteiras aprovados localmente. Solicitação pública completa e conversão em locação seguem nas próximas fases.

### Fase 6 — P1

- [x] Home, catálogo/filtros, detalhes, categorias, contato e publicação de políticas pelo ADMIN.
- [x] Período/fuso, cotação no servidor, dados do cliente, entrega/coleta, aceite versionado e protocolo REQUESTED.
- [x] Antispam distribuído, Turnstile verificado no servidor, limites, token de status e proteção de enumeração.
- [x] Layout mobile, labels/live regions, estados e idempotência; axe e percurso de formulário desktop/mobile com adapters de teste.
- [x] SQL real da solicitação pública até aprovação manual; preservar cliente existente e dados declarados privados.
- [ ] E2E HTTP completo com Supabase/Turnstile reais e revisão por leitor de tela.
- [ ] Configurar credenciais/widget/hostname, publicar dados e textos aprovados, homologar PostgreSQL 17/pgTAP e gerar tipos.

Implementação da Fase 6 em [public-site.md](public-site.md). Não houve publicação remota. O formulário E2E intercepta APIs/widget somente nos testes; não comprova integração HTTP real.

### Fase 7 — P0/P1

- [x] Criar locação direta e converter reserva sem liberar alocação entre operações.
- [x] Check-out com documentos/condutor/contrato/vistoria/recebimento configurados.
- [x] Logística agendada e realizada; taxas persistidas em orçamento/contrato.
- [x] Prorrogação atômica, novo snapshot/aditivo, conflito e rollback.
- [x] Checklist versionado, vistorias inicial/final, fotos privadas e imutabilidade.
- [x] Templates/PDF versionados, hash, worker, status de falha e URLs autorizadas.
- [x] Check-in, km/combustível, danos, cobranças extras e encerramento configurado.
- [x] Alertas operacionais de atraso e identificação de próximas reservas afetadas; SQL e limites HTTP testados.
- [ ] E2E autenticado completo no Supabase/Storage real, pgTAP/PostgreSQL 17 e revisão assistiva.
- [ ] Configurar modelos aprovados, regras, segredos e agendamento do worker em homologação.

Entrega e dependências em [rentals.md](rentals.md). Não houve geração de contrato real, publicação remota ou configuração de agendador; PDF de QA é fictício.

### Fase 8 — P0/P1

- [x] Cobranças, recebimentos explícitos/parciais e meios configuráveis.
- [x] Alocação atômica, caução, reembolso, desconto, multa e estorno compensatório.
- [x] Preventiva/corretiva, óleo/pneus/revisões, despesas e alertas por km/data no fuso da empresa.
- [x] Bloqueio de manutenção usa a mesma exclusão de reservas; conflitos desfazem a operação.
- [x] Dashboard com período, ocupação observada, pendências, devoluções e movimentações financeiras confirmadas, separadas das cauções.
- [x] Relatórios: contratado/recebimentos, reservas, ocupação, resultado/despesas por veículo, recorrência, atraso, saldos e manutenção.
- [x] Exportação CSV com autorização, limite, auditoria, paginação e neutralização de fórmulas.
- [x] Adaptador Resend, outbox, snapshots, leases, retries, deduplicação e dead letters; sem envio real nesta entrega.
- [ ] Homologar Supabase/PostgreSQL 17/pgTAP, JWT/PostgREST, percurso autenticado e acessibilidade das telas novas; gerar tipos oficiais.
- [ ] Configurar agendadores/segredos, domínio/remetente/provedor e rotas EMAIL aprovadas; testar entrega/reconciliação com destinatários controlados.

Implementação local e definições em [business-operations.md](business-operations.md), contratos em [api/business.md](api/business.md) e evidências em [verification.md](verification.md). Sentry continua opcional e não integrado. Não houve deploy nem escrita remota.

### Fase 9 — P0

- [x] Suite unitária de preço/períodos/transições/descontos/cobranças/permissões, uploads/PDF e configuração de promoção.
- [x] Integração SQL/RLS/concorrência e fechamento financeiro no PostgreSQL isolado; versão/serviços Supabase reais pendentes.
- [ ] E2E login → cadastros → solicitação → aprovação → vistoria → pagamento → retirada → devolução → encerramento.
- [x] Revisão local de segurança/segredos/dependências/uploads/rotas; scanner de imports, gate pré-build e readiness privada.
- [x] Build/types/lint/format, acessibilidade pública e medições locais de standalone/consulta; telas autenticadas e carga real pendentes.
- [x] OpenAPI 3.1/referências validadas com cobertura dos 30 endpoints API; schemas estruturais gerados de Zod.
- [x] Preparar Dockerfile, standalone, CI e roteiro de promoção/rollback/recuperação.
- [ ] Executar workflow Supabase/PostgreSQL 17, pgTAP/advisors, tipos oficiais e smoke HTTP autenticado preparados; falta Docker/stack nesta máquina.
- [ ] Homologação separada, backups/restauração, worker, alertas, deploy e rollback ensaiados.
- [ ] Critérios 1–18 do pedido original demonstrados com evidências; aprovação operacional da empresa.

Preparação local entregue em [phase-9.md](phase-9.md), com [matriz de aceite](acceptance.md). Não confundir os checks locais aprovados com deploy ou aceite comercial. Configuração de produção ainda é recusada pelo gate enquanto faltarem credenciais/segredos.

## Fora do MVP

Multiempresa, assinatura eletrônica integrada, pagamento online, mapas/distância e relatórios PDF. Não criar essas integrações ou contratar serviços como parte das fases iniciais.
