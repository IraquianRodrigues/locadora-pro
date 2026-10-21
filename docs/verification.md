# Execução e verificações

## Configuração remota — 20/10/2026

Projeto autorizado `zfvqvzhajnjwpsbajqux`, PostgreSQL 17.11: **26 migrations aplicadas, 64 tabelas com RLS, quatro buckets privados e dez verificações SQL de leitura aprovadas**. As cinco views financeiras agora usam security_invoker; advisor sem erros de segurança e somente índices ainda não usados em performance. Permanecem avisos das RPCs intencionais, descritos em [supabase-project.md](supabase-project.md).

Suíte isolada atual: **81 testes aprovados**, 26 migrations, PostgreSQL 18.4, recibo `fdaa0ca0-ad5c-45a9-aa04-7d24082e9236`. Build com as variáveis públicas reais aprovado. Verificação HTTP bloqueia conclusão porque o cadastro público ainda está habilitado. Não houve login autenticado, criação de ADMIN, envio de e-mail ou deploy da aplicação. Gate de deploy indica origem HTTPS/chave de serviço/Turnstile pendentes. Não confundir estes testes de leitura remotos com a suíte completa pgTAP/HTTP autenticada.

## Fase 9 — 20/10/2026

Preparação local concluída: revisão de fronteiras/segredos/uploads, parser PDF em worker limitado, proteção de chave pública antes do build, CSP/HSTS, índices, prontidão privada e empacotamento standalone/Docker/CI. Não houve deploy remoto. Runbook em [phase-9.md](phase-9.md), critérios em [acceptance.md](acceptance.md).

| Verificação                       | Evidência executada                                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                        | 149 testes aprovados em 19 arquivos, incluindo PDF comprimido/escapado, upload com resposta perdida, gate e readiness                   |
| `npm run test:db`                 | 80 cenários aprovados no PostgreSQL 18.4, com 25 migrations do zero e 64 tabelas; recibo `b4c0827f-b800-490f-a59a-0cfb0fee5411`         |
| Consulta com volume               | EXPLAIN ANALYZE em 10.000 despesas fictícias, índice `expenses_period` usado, execução local 0,042 ms; fixtures revertidas após o teste |
| `npm run test:e2e`                | 46 testes aprovados desktop/mobile, incluindo CSP/readiness e verificações axe públicas, usando `npm start` standalone                  |
| `npm run build`                   | Produção standalone concluída, incluindo fonte/licença e worker PDF                                                                     |
| `npm run test:standalone`         | Servidor e 13 assets verificados, 652.795 bytes descomprimidos; fonte/OFL e worker PDF executável incluídos                             |
| Liveness aquecida                 | Dez amostras locais: p50 14,13 ms, máximo 16,96 ms; sem carga/Supabase, não é SLO de produção                                           |
| Tipos/lint/Prettier               | Aprovados                                                                                                                               |
| `npm run check:security`          | 169 módulos analisados, 30 rotas API inventariadas; sem achados nos padrões/imports verificados                                         |
| `npm run check:api`               | OpenAPI 3.1 e referências públicas/administrativas/internas validadas; todos os métodos das 30 rotas cobertos                           |
| `npm audit --audit-level=high`    | Zero vulnerabilidades encontradas em dependências de produção e desenvolvimento                                                         |
| `npm run deploy:check`            | Recusou promoção pela ausência de origens/chaves/Turnstile/segredos; comportamento esperado, valores não expostos                       |
| `npm run test:supabase:http`      | Recusou antes de iniciar testes: falta E2E_APP_URL/stack local descartável e credenciais fictícias                                      |
| pgTAP 008/PostgreSQL 17/Docker/CI | Preparados, não executados nesta máquina sem Docker/stack; Dockerfile não foi construído aqui                                           |

Dependências novas somente de desenvolvimento: `@apidevtools/swagger-parser@13.1.0` e `yaml@2.9.1`. O validador encontrou e foi corrigida uma propriedade YAML indevida na resposta 404 de consulta por token; contratos de locações e rotas internas foram acrescentados. Schemas estruturais continuam derivados de Zod, com refinamentos/regras SQL documentados separadamente.

O smoke é verificável em `output/standalone-smoke.json`; o recibo SQL está em `.database-tests/latest-result.json`. O workflow Supabase foi ampliado para lint/pgTAP/SQL completo/tipos/HTTP Auth local, mas não foi executado remotamente. A suíte HTTP preparada é um smoke, não o percurso comercial inteiro no navegador.

Gates ainda externos: Supabase real e tipos, Auth/refresh/recovery/SMTP, Storage/Turnstile, telas autenticadas/acessibilidade, entrega/reconciliação de email, domínio/hospedagem, jobs, RPO/RTO, backup/restauração, imagem Linux/scan, carga realista e aceite operacional dos critérios 1–18. Sem configuração de produção, não há promoção automática nem alegação de sistema liberado comercialmente.

## Fase 8 — 20/10/2026

Financeiro, cauções/reembolsos/compensações, manutenção com ocupação central, indicadores, dez relatórios/CSV e notificações implementados. São 24 migrations e 64 tabelas; as anteriores permanecem preservadas. Regras, segredos, jobs, provider e percurso de homologação em [business-operations.md](business-operations.md), contratos em [api/business.md](api/business.md).

| Verificação                               | Resultado                                                                                                                                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                | 137 testes aprovados em 18 arquivos; centavos, confirmação explícita, schemas, fuso/DST, CSV, adaptação de email e falhas/ambiguidade do worker                                               |
| `npm run test:db`                         | 78 cenários aprovados em PostgreSQL 18.4 isolado, aplicando as 24 migrations do zero                                                                                                          |
| Recibo SQL atual                          | `979e4edd-dcdc-4340-b42e-1e6d33c76435`, em `.database-tests/latest-result.json`                                                                                                               |
| `npm run test:e2e`                        | 42 testes desktop/mobile aprovados; fronteiras de acesso, worker fechado e suites existentes                                                                                                  |
| Fronteiras Fase 8 em produção local       | 6 cenários novamente aprovados, ampliados com detalhe/PATCH de manutenção e cargo forjado                                                                                                     |
| `npm run build`                           | Produção concluída com rotas financeiras, manutenção, relatórios, caixa e worker                                                                                                              |
| `npm run typecheck` / `npm run lint`      | Aprovados, sem erros/warnings de lint                                                                                                                                                         |
| `npm run format:check`                    | Aprovado                                                                                                                                                                                      |
| `npm audit --omit=dev --audit-level=high` | Zero vulnerabilidades de produção encontradas                                                                                                                                                 |
| Contratos API                             | Schemas JSON gerados diretamente de Zod; YAML analisado pelo Prettier. Refinamentos/validações transacionais são documentados separadamente; validação integral da OpenAPI continua na Fase 9 |
| pgTAP 007 / Supabase real                 | Preparado; não executado sem stack/projeto configurado                                                                                                                                        |

Os novos cenários SQL cobrem concorrência de saldo/recebimento/caução, devoluções limitadas, ajuste acumulado por cargo, compatibilidade com a RPC anterior, cliente divergente, cancelamento após restituições, conflitos de manutenção, conclusão/despesa atômica, alertas no fuso da empresa, separação de indicadores, competência/paginação, caixa própria e recuperação/reconciliação de leases. Nenhuma tentativa real de email foi feita.

Limites: PostgreSQL alvo 17 e serviços Supabase completos ainda precisam de homologação; o harness 18.4 usa shim SQL Auth/Storage. Os testes browser desta fase comprovam fronteiras sem configuração, não percorrem as novas telas autenticadas contra PostgREST/JWT reais. Acessibilidade dessas telas, entrega/bounce, domínio/remetente, jobs, monitoramento, geração oficial de tipos e deploy estão pendentes. Não houve escrita remota, ativação de rota EMAIL ou contratação de serviço.

## Fase 7 — 20/10/2026

Implementados locação direta e conversão preservando a alocação, retirada/devolução com pré-requisitos no banco, logística, prorrogação com aditivo e rollback, vistorias/fotos congeladas, avaliação de avarias, apuração única de excedentes, contratos privados em PDF e worker com lease/retries. A identidade da locadora e as regras operacionais são configuráveis e congeladas. A migration nova preserva as anteriores; total de 21 migrations e 58 tabelas.

| Verificação               | Resultado                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npm test`                | 119 testes em 15 arquivos, incluindo renderer PDF real, aditivo e falhas/ambiguidade do worker                    |
| `npm run test:db`         | 56 cenários aprovados no PostgreSQL 18.4 isolado, aplicando as 21 migrations                                      |
| `npm run test:e2e`        | 36 testes aprovados em desktop/mobile; novos cenários verificam bloqueio das telas/APIs e worker sem configuração |
| `npm run build`           | Build de produção concluído com novas rotas de locação e worker Node                                              |
| Tipos, lint e Prettier    | Aprovados                                                                                                         |
| `npm audit --omit=dev`    | Zero vulnerabilidades de produção encontradas                                                                     |
| PDF de homologação        | Duas páginas A4, renderizadas com Poppler e inspecionadas; pdfplumber conferiu texto/limites de 3.614 caracteres  |
| pgTAP 006 / Supabase real | Preparado; ainda não executado sem stack/projeto configurado                                                      |

Exemplo fictício em `output/pdf/contrato-exemplo-ficticio.pdf`, reproduzível com `node scripts/preview-contract.ts`. `pdf-lib` e fontkit são dependências do servidor; a fonte Noto Sans foi incluída com sua licença OFL. Python/Poppler serviram apenas à revisão local.

O teste SQL usa o shim Auth/Storage descrito no guia de banco; não comprova JWT criptográfico, PostgREST ou download real. O navegador não executou um ciclo autenticado de locação contra Supabase. Permanecem aplicação/homologação no PostgreSQL 17, tipos oficiais, Auth/Storage reais, identidade/modelos/regras aprovados, configuração do segredo e agendamento do worker. Financeiro completo e notificações seguem na Fase 8. Detalhes e matriz de homologação em [rentals.md](rentals.md). Nenhuma migration, automação ou contrato real foi publicado remotamente.

## Fase 6 — 20/10/2026

Rodada final: **30 testes E2E aprovados** no build de produção, mantendo os anteriores e incluindo quatro novos cenários públicos desktop/mobile. `npm run format:check` também conferido após a formatação da documentação; não houve instalação de dependências nesta fase.

Implementados catálogo público, busca/categoria/unidade/paginação, detalhes e categorias, contato/políticas publicados pelo ADMIN, cotação por fuso do plano, dados PF/PJ/endereço brasileiro, entrega/coleta, aceite versionado, solicitação REQUESTED e consulta por token. O painel publica planos/adicionais e fotos explicitamente; documentos continuam privados. Cliente existente não é sobrescrito: dados declarados e textos exatos aceitos ficam no intake privado, visível à equipe autorizada.

Migrations novas 19/20 preservam as 01–18; total de 56 tabelas. Funções públicas de catálogo usam allowlist e publicação global, inclusive projeções legadas. RPCs confiáveis de cálculo/ownership/solicitação são exclusivas de service_role. Solicitação de equipe e pública compartilham helper transacional; histórico/outbox e origem única continuam atômicos. Cookie HMAC HttpOnly, Origin, limite real de corpo, honeypot, tempo mínimo, quotas distribuídas e Turnstile Siteverify com hostname/action/validade impedem bypass da UI. Nenhuma dependência nova foi instalada na Fase 6.

| Verificação                          | Resultado                                                                                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                           | 106 testes em 13 arquivos, incluindo 10 novos de cookie, schemas, fuso/DST, Siteverify, falha fechada, quotas, cotação real, replay e hash de token |
| `npm run test:db`                    | 20 migrations reaplicadas e 45 cenários reais em PostgreSQL 18.4; recibo `8622e0e2-6b68-410d-b7f2-9c03b85ec8ba`                                     |
| `npm run typecheck` / `npm run lint` | TypeScript strict, rotas e lint aprovados, sem warnings                                                                                             |
| `npm run build`                      | Build de produção aprovado com páginas públicas e rotas dinâmicas de catálogo/solicitação                                                           |
| `npm audit --audit-level=high`       | Zero vulnerabilidades                                                                                                                               |
| Playwright do formulário             | 4 cenários novos desktop/mobile aprovados após correção de seletores; formulário com HTTP/widget interceptados somente no teste                     |
| axe / revisão visual                 | Sem violações automáticas nas páginas novas e no formulário carregado nos dois viewports; screenshot mobile inspecionado, sem corte horizontal      |

Os seis cenários SQL novos testam publicação por permissão/versão, fechamento das projeções antigas, filtros sem campos internos, tarifas publicadas, idempotência concorrente/ownership, solicitação e aprovação reais, intake/aceite/histórico/outbox, preservação do cadastro existente e publicação/retirada/arquivamento de fotos. Todos os cenários anteriores foram mantidos. Siteverify e chamadas HTTP Supabase não são simulados fora dos testes; sem configuração, as operações falham fechadas.

As verificações encontraram tipagem da lista vazia/variante de botão e seletores Playwright que não correspondiam à associação de labels de selects ou coincidiam com o anúncio interno do Next. Foram corrigidos usando tipagem explícita e papéis/escopo de acessibilidade, mantendo asserções e axe. A gravação de aceite foi reforçada para preservar o texto e a publicação é verificada sob lock. Nenhuma verificação foi desativada.

**Pendente de configuração:** Supabase/PostgreSQL 17, pgTAP/lint, tipos oficiais, JWT/PostgREST/Storage, widget/Siteverify reais no hostname, dados/textos aprovados e publicação administrativa. O percurso E2E HTTP navegador → Supabase → aprovação autenticada → status ainda não foi executado; SQL cobre o percurso real no banco, e o navegador usa adapters de HTTP/widget somente na suíte. Revisão com leitor de tela e comportamento real do desafio também permanecem pendentes. Preparado pgTAP 005; não executado na stack completa. Não houve aplicação remota, deploy, criação de conta Cloudflare, contratação ou envio de mensagens. Configuração, quotas/retencão, limitações e matriz em [public-site.md](public-site.md).

## Fase 5 — 20/10/2026

Verificação final: `npm run lint`, `npm run typecheck` e `npm run format:check` aprovados, sem erros ou warnings. `npm audit --audit-level=high`: zero vulnerabilidades. OpenAPI formatada e aceita pelo parser YAML do Prettier.

Implementados planos/preços/adicionais com CRUD/RLS, vigência e precedência, motor no servidor com centavos bigint e Temporal, mês calendário/comercial, tolerância/pacotes/arredondamento, logística fixa, desconto autorizado e caução separada. Cotações persistem snapshot imutável com fingerprint; nenhuma entrada de total do navegador é aceita. Reservas administrativas têm solicitação, logística/histórico/outbox, revisão otimista, decisão por cargo, atribuição de veículo sob lock, cancelamento e expiração por lote. Intervalo configurado após devolução entra na ocupação central e na infraestrutura de prorrogação.

Migrations novas 16–18, mantendo 54 tabelas e preservando as 01–15. Quote/itens tiveram RLS restringida para pricing.read **e** reservations.read, evitando acesso financeiro isolado aos endereços. Persistência confiável revalida sessão/cargo/desconto e fingerprint no banco. Endpoint público de status aceita token só em cabeçalho, salva apenas hash, retorna campos mínimos e usa limite distribuído. A submissão pública é Fase 6. Dependência direta adicionada: `@js-temporal/polyfill@0.5.1`, lockfile atualizado; sem novas integrações/serviços.

| Verificação        | Resultado                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`           | 251 pacotes instalados; auditoria inicial com zero vulnerabilidades                                                             |
| `npm test`         | 96 testes em 12 arquivos; motor, schemas, serviços e status/limitador novos, mantendo os anteriores                             |
| `npm run test:db`  | 18 migrations do zero e 39 cenários SQL em PostgreSQL 18.4 isolado; recibo runId `2f427352-3f6f-4623-808b-c43d26e84094`         |
| `npm run build`    | Build de produção aprovado com tarifas, reservas, cotações, disponibilidade e status dinâmicos                                  |
| `npm run test:e2e` | 26 testes desktop/mobile aprovados; novas rotas fechadas sem credenciais, mutações diretas recusadas e status público sem cache |
| axe                | Verificações públicas/Auth existentes mantidas; zero violações automáticas nos dois viewports                                   |

Os 9 cenários SQL novos comprovam precedência/vigência, fingerprint alterado, RPC privilegiada/sessão, snapshot preservado, versão de política, limite de desconto no banco, cópia da cotação sem cliente, origem única, token/status mínimo, disputa por categoria com um vencedor, buffer/adjacência, revisão/idempotência/cancelamento, expiração restrita e tarifa arquivada. O motor cobre fevereiro bissexto, aniversário de fim de mês, diferença entre dia civil e 24h no DST, tolerância no milissegundo limite, incrementos, taxas, desconto e overflow. Serviços usam adapters só em teste; o SQL não é mockado.

As primeiras rodadas encontraram uma revogação ampla que atingia helpers RLS, ambiguidade de variável SQL em disponibilidade e uma chamada de relógio no componente de página sinalizada pelo lint. Foram corrigidas com revogação restrita às funções novas, nome de variável explícito e cálculo da expiração no serviço. A suíte SQL completa voltou a passar, sem desativar verificações. Os avisos de cor do executor e install script do wrapper PostgreSQL não impediram testes.

**Pendente:** credenciais/projeto Supabase, Docker/CLI, PostgreSQL 17/pgTAP/lint, tipos oficiais, JWT/PostgREST e interface autenticada/visual/assistiva. Não há `.env.local` neste workspace nem CLI/Docker no PATH. Regras/tarifas comerciais reais, retenção e agendamento do job de expiração ainda precisam ser configurados; worker de notificações segue na Fase 8. Nenhuma migration remota, cron, envio externo ou deploy foi realizado. Escopo, procedimentos e matriz em [reservations.md](reservations.md). O pgTAP 004 foi preparado e não executado na stack completa.

## Fase 4 — 19/10/2026

Implementados cadastros de categorias, frota, clientes PF/PJ e condutores, com unidades como pré-requisito, consulta paginada/filtros, criação, edição com revisão, arquivamento/restauração e histórico real de locações/manutenção conforme permissão. Interfaces e REST compartilham validação/serviço; nenhuma escrita de CRUD usa service role. Validações brasileiras incluem DV de CPF/CNPJ numérico e alfanumérico, telefone com DDD, endereço com CEP/UF e datas civis, placa/chassi/RENAVAM e formato de CNH. Não há consulta externa nem validação de autenticidade/DV da CNH/RENAVAM.

Migrations novas 14/15 preservam as 01–13 e acrescentam guardas de integridade e `registry_files`, a 54ª tabela. Pipeline de arquivos privado com checagem de conteúdo/MIME/extensão/tamanho, imagens reprocessadas sem EXIF, limite de 4 MiB, registro de status e compensação, permissões revalidadas e links de 60 segundos emitidos com sessão/RLS. A chave de serviço fica restrita a upload validado/metadados/compensação e limitador. Sharp 0.35.5 passou de dependência transitiva do Next para dependência direta fixada; lockfile auditado antes da instalação.

| Verificação                               | Resultado                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci` / `npm audit --audit-level=high` | Instalação concluída; zero vulnerabilidades                                                                                                 |
| `npm run lint`                            | Sem erros ou warnings                                                                                                                       |
| `npm run typecheck`                       | Rotas e TypeScript strict aprovados                                                                                                         |
| `npm test`                                | 70 testes em 10 arquivos; 29 novos testes de cadastros/conteúdo/serviços/Storage                                                            |
| `npm run test:db`                         | 15 migrations do zero e 30 cenários SQL em PostgreSQL 18.4 isolado; recibo atual em `.database-tests/latest-result.json`                    |
| `npm run build`                           | Build de produção com páginas e API dinâmicas para os cinco recursos                                                                        |
| `npm run test:e2e`                        | 20 cenários desktop/mobile; os novos cobrem bloqueio de listas, detalhes, criação e chamadas diretas GET/POST/PATCH/DELETE sem configuração |
| axe                                       | Mantidas as verificações anteriores das páginas públicas/Auth; zero violações automáticas nos dois viewports                                |
| `npm run format:check`                    | Formatação verificada; OpenAPI de cadastros formatada em YAML                                                                               |

Novas evidências SQL: CRUD persistente, duplicidade normalizada, clientes PF/PJ, vínculo de condutor, revisão concorrente com um único vencedor, preservação de histórico, bloqueio de arquivamento com compromissos, file owner/path, lifecycle e hash imutáveis, upload direto negado, acesso por cargo/tipo/status e impossibilidade de reutilizar metadado legado para ler arquivo novo arquivado. Testes de conteúdo exercitam Sharp nativo com bytes de imagem, EXIF removido, MIME/extensão divergentes, tamanho e inspeção básica de PDF. SDK/serviços usam adapters simulados somente nos testes; não são um ambiente de produção simulado.

As verificações corrigiram expectativa de UPDATE sem permissão: RLS pode retornar zero linhas, sem exceção; o teste agora exige zero alteração. A primeira rodada E2E tratava Location relativo como URL absoluta; foi corrigida e repetida. Tipagem e formatação também foram corrigidas antes da conclusão. Nenhuma verificação foi desativada. Avisos NO_COLOR/FORCE_COLOR do executor e install script do wrapper PostgreSQL no Windows não impediram os testes.

**Pendente:** interface autenticada completa e HTTP PostgREST/Storage/URLs assinadas com JWT real, pgTAP e PostgreSQL 17, geração oficial de tipos e revisão visual/assistiva das telas autenticadas. CLI/Docker não estão no PATH e as três variáveis Supabase não estão configuradas; nenhum projeto remoto foi acessado. Revisão de dados legados/constraints NOT VALID, políticas preexistentes, retenção/reconciliação e tratamento de PDFs também exigem homologação. Limites da inspeção de PDF, TTL de signed URLs, setup e matriz completa em [registry.md](registry.md). Não houve deploy.

## Fase 3 — 19/10/2026

Implementados login/logout, recuperação e atualização de senha, confirmação de recovery por POST, callback PKCE, cookies SSR HttpOnly, proxy e guards independentes para páginas/API/ações. RBAC lê perfil, cargos, permissões e sessão atuais no banco; metadata não concede acesso. Dashboard consulta contagens reais via RLS e a gestão de acessos usa a RPC que preserva o último ADMIN.

Migration 13 nova; migrations 01–12 preservadas. Atualizados shim/fixtures e pgTAP para `auth.sessions`/`auth.jwt()`. Rate limit distribuído usa upsert atômico, hashes HMAC e acesso exclusivo de service_role. Demais operações usam o JWT do funcionário. Dependência acrescentada: React Hook Form 7.90.0, compatível com React 19; Zod integrado diretamente. O pacote opcional de resolvers 6.0.0 apresentou conflito de peers transitivos e não foi instalado, sem force/overrides.

| Verificação                               | Evidência                                                                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci` e `npm audit --audit-level=high` | Instalação concluída; zero vulnerabilidades                                                                                        |
| `npm run lint`                            | Sem erros ou warnings                                                                                                              |
| `npm run typecheck`                       | Tipos de rotas e TypeScript estrito aprovados                                                                                      |
| `npm test`                                | 41 testes em 6 arquivos: 10 anteriores e 31 de Auth, usando adapters simulados somente nos testes                                  |
| `npm run test:db`                         | 13 migrations e 22 cenários em PostgreSQL 18.4 isolado; recibo em `.database-tests/latest-result.json`                             |
| `npm run build`                           | Build de produção; Auth, painel, usuários, API e callback dinâmicos; proxy reconhecido                                             |
| `npm run test:e2e`                        | 16 cenários aprovados em Chromium desktop e viewport mobile; build sem credenciais Supabase                                        |
| axe                                       | Zero violações automáticas nas cinco páginas verificadas em ambos os viewports: home, login, recovery, confirmação e acesso negado |
| `npm run format:check`                    | Formatação verificada                                                                                                              |

Unidades cobrem redirect externo, origem, força/confirmação de senha, assinatura/validade/vínculo de recovery, limites, resposta uniforme, RBAC, logout com falha, gestão de acessos e preservação de cookies pelo proxy em redirecionamento. SQL cobre sessão ausente/alheia/expirada/encerrada, perfil sem cargo/inativo, permissões alteradas sem renovar JWT, limite simultâneo com exatamente cinco aceitações e auditoria sanitizada. Mantidos todos os cenários da Fase 2, incluindo concorrência de reserva e pagamento.

A primeira execução de banco dentro do sandbox não conseguiu consultar o usuário do Windows (`uv_os_get_passwd`); execução autorizada do mesmo comando concluiu. A primeira rodada E2E encontrou um seletor ambíguo com o alerta interno do Next; seletor corrigido e suíte repetida sem desativar verificações. O aviso NO_COLOR/FORCE_COLOR do ambiente não afeta os resultados.

**Pendente no Supabase real:** pgTAP/PostgreSQL 17, tipos oficiais, login e refresh HTTP, revogação/logout com JWT real, PKCE, entrega SMTP, links OTP, PostgREST e Storage. Sem credenciais, contas ou Docker/CLI, esses resultados não são alegados. O teste SQL usa shim dos contratos Auth/Storage; testes unitários usam mocks; E2E cobre o estado fechado sem configuração. Procedimento completo e matriz de homologação em [authentication.md](authentication.md). Nenhum projeto remoto foi modificado e nenhum deploy foi feito.

## Histórico — Fases 0/1

Os resultados abaixo são históricos dessa entrega. Para a Fase 2, ver [phase-2.md](database/phase-2.md); para o estado atual, usar a seção da Fase 3 acima.

Data: 19/10/2026. Fases 0 e 1 verificadas localmente; as limitações abaixo permanecem explícitas.

## Inventário criado

- Documentação: README, diagnóstico, arquitetura/estrutura, ADRs/pendências, ER, plano de migrations, fluxos/estados, matriz RBAC, segurança, backlog, deployment e contrato/catálogo REST.
- Configuração: package/lockfile, TypeScript strict, Next, Tailwind/PostCSS, shadcn components.json, ESLint, Prettier, Vitest, Playwright, exemplo de ambiente e CI.
- Código: layouts público/auth, home de preparação, acesso de equipe indisponível, redirecionamento administrativo fechado, loading/error/404, componentes UI, clientes Supabase isolados, validação de ambiente e liveness.
- Testes: limites de configuração e timezone; E2E de preparação, redirecionamento administrativo, headers, navegação, viewport, teclado e 404.

Não foram criados módulos de negócio, migrations aplicadas, dados seed, integrações pagas, projeto remoto ou deploy.

## Dependências

Core: Next 16.4.2, React/React DOM 19.3.1, Tailwind 4.3.3, Supabase JS 2.118.0/SSR 0.12.7 e Zod 4.6.7. Componentes shadcn adaptados localmente por instalação manual com Radix Slot, CVA, clsx e tailwind-merge; Lucide para ícones. Não é necessário instalar um pacote runtime chamado shadcn.

Qualidade: TypeScript 5.9.3, ESLint 10.13.0, regras TS/Hooks, Prettier 3.9.10, Vitest 5.0.5, Playwright 1.64.1 e axe/Playwright 4.14.0. Tipos Node 24.19.2 e React/DOM 19.3.0. Versões transitivas no lockfile. React Hook Form será instalado no primeiro formulário real (Fase 3); TanStack Query, Zustand, Sentry, PDF e e-mail não foram instalados sem caso de uso.

UI: Radix Slot 1.5.0, class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 3.7.0 e lucide-react 0.577.0. Ferramentas: @eslint/js 10.0.1, typescript-eslint 8.72.0, eslint-plugin-react-hooks 7.1.1, eslint-config-prettier 10.1.8 e PostCSS 8.5.31.

## Auditoria antes da instalação

1. Consultadas fontes oficiais e registro npm para engines/peers/versões.
2. `npm install --package-lock-only --ignore-scripts`: árvore inicial com cinco alertas altos, todos na cadeia eslint-config-next → fast-glob → micromatch → braces.
3. Verificado [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): sem versão corrigida de braces; dependência era de desenvolvimento.
4. Substituído preset Next por configurações explícitas TS/Hooks. Acessibilidade validada via axe no Playwright; ESLint 10 evita a linha 9 sem suporte e peers incompatíveis do plugin JSX a11y. Sem downgrade do framework, override incompatível ou supressão de alertas.
5. Lockfile resolvido novamente: **zero vulnerabilidades** antes da instalação.

## Resultados finais

| Comando / verificação                              | Resultado                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `node --version`, `npm --version`, `git --version` | Ferramentas confirmadas; ver diagnóstico                                                         |
| `npm view` para versões/engines/peers              | Compatibilidade verificada antes de instalar                                                     |
| `npm install --package-lock-only --ignore-scripts` | Lockfile final auditado, zero vulnerabilidades                                                   |
| `npm ci`                                           | 231 pacotes instalados, 232 auditados; zero vulnerabilidades na árvore final                     |
| `npm run format` / `npm run format:check`          | Formatação aplicada e verificada                                                                 |
| `npm run lint`                                     | Sem erros ou warnings de lint                                                                    |
| `npm run typecheck`                                | Tipos de rotas gerados e TypeScript sem erros                                                    |
| `npm test`                                         | 2 arquivos, 10 testes unitários aprovados                                                        |
| `npm run build`                                    | Build otimizado Next 16.4.2 concluído; rotas /, /login, /admin/[[...path]], /api/v1/health e 404 |
| `npx playwright install chromium`                  | Chromium 156 de testes e ferramentas baixados com autorização                                    |
| `npm run test:e2e`                                 | 10/10 aprovados: 5 cenários em desktop e 5 em viewport mobile; execução final 6,5 segundos       |
| axe com tags WCAG A/AA até 2.2                     | Zero violações automaticamente detectadas em / e /login, nos dois viewports                      |
| Capturas desktop/mobile                            | Home revisada visualmente; sem overflow horizontal nos testes                                    |

Os testes automatizados de acessibilidade não comprovam conformidade completa WCAG; revisão manual assistiva continua necessária antes da homologação.

## Correções guiadas pelas verificações

- URL inválida escapava como TypeError em refinamento: substituído por validação segura com erro de configuração controlado; teste cobre o cenário.
- Redirecionamento administrativo pelo componente podia ocorrer após início do streaming com HTTP 200: bloqueio antecipado em `next.config.ts` retorna 307 para todas as subrotas, com fallback no componente. Remover/substituir ambos somente junto do guard Auth/RBAC na Fase 3.
- Nome acessível da marca não continha exatamente o texto visível: corrigido; axe passou sem exceções ou regras desativadas.
- Primeira execução E2E no sandbox Windows concluiu os cenários mas ficou presa ao encerrar o servidor Next. O processo específico foi identificado e finalizado; repetição autorizada fora do sandbox passou e encerrou normalmente. Nenhum processo alheio ao teste foi encerrado.

O ambiente de execução emite aviso sobre NO_COLOR/FORCE_COLOR; não afeta resultados. Não foi ocultado. O Git local ainda não foi inicializado e não existe remoto/PR; os arquivos estão no diretório de trabalho fornecido.

## Próxima fase

Fase 2: implementar migrations na ordem documentada, configurar Supabase de desenvolvimento, gerar tipos, testar constraints, RLS e concorrência. Docker/CLI ou projeto de banco acessível são pré-requisitos dos testes reais. Não foi iniciado módulo de negócio antes dessa fundação.

## Limites da evidência

Sem credenciais e sem Docker/CLI Supabase, não é possível afirmar conexão, execução de migrations, RLS, autenticação, concorrência SQL, Storage, envio de e-mail ou PDF. O cliente SSR desta fase é apenas de leitura e recusa refresh de sessão; proxy/handlers com escrita de cookies serão implementados e testados na Fase 3, antes de qualquer login real. Esses testes pertencem às próximas fases. CI foi preparada localmente e não executada no GitHub. Deploy e homologação ainda não realizados. Diagramas Mermaid foram revisados em fonte; renderização automatizada dos diagramas não foi executada.
