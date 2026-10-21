# Fase 9 — validação, segurança e preparação de entrega

Atualização posterior: o projeto Supabase indicado pelo usuário recebeu as 25 migrations desta fase e a migration 26 de correção das projeções financeiras, com verificações reais no PostgreSQL 17.11. Configuração Auth e chave de servidor ainda pendentes. Estado atual em [supabase-project.md](supabase-project.md). O relatório abaixo preserva a entrega local anterior.

Trabalho local de 20/10/2026. O pacote está preparado para homologação; **não houve deploy remoto e a liberação comercial ainda depende dos itens externos abaixo**. As 25 migrations mantêm 64 tabelas da aplicação. As evidências executadas estão em [verification.md](verification.md).

## Correções e verificações

| Área             | Resultado local e limite                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PDFs recebidos   | Parser estrutural pdf-lib em worker isolado (5 segundos, 128 MiB de heap), nomes decodificados e inspeção de objetos comprimidos/dicionários. Recusa arquivos inválidos, criptografados, ações, links externos ativos, anexos e mais de 100 páginas/5 mil objetos/20 mil nós. Preserva bytes originais de documentos aceitos; não é antivírus/CDR nem garantia contra toda vulnerabilidade de leitor PDF. |
| Upload ambíguo   | Antes de compensar falha, consulta estado: READY preserva arquivo; estado desconhecido impede exclusão e exige reconciliação. Testes reproduzem resposta perdida após commit.                                                                                                                                                                                                                             |
| Browser          | CSP para base/objetos/frames/formulários; Turnstile tem origem de iframe explícita. HSTS de 180 dias quando a origem pública do build usa HTTPS. Sem preload/includeSubDomains. A CSP não implementa nonce/script-src; não deve ser tratada como proteção completa contra XSS.                                                                                                                            |
| Servidor/cliente | Análise de imports em 169 módulos, respeitando fronteiras de Server Actions e imports de tipo; detecta caminho do cliente até server-only/segredos conhecidos. Não substitui análise manual ou DAST.                                                                                                                                                                                                      |
| Segredos         | Scanner de padrões de credencial nos fontes/scripts/docs/workflows; emite apenas arquivo/regra. Configuração privada permanece fora do Git/contexto Docker. Auditar também provedor, histórico Git e logs antes de produção.                                                                                                                                                                              |
| API              | 30 rotas inventariadas em [security/endpoints.json](security/endpoints.json). OpenAPI 3.1 e referências validadas com swagger-parser, com cobertura de métodos de todas as rotas API. Server Actions/callback PKCE são revisão separada.                                                                                                                                                                  |
| Banco            | Migration 25 acrescenta índices de filtros/paginação por período e `operational_readiness()` exclusiva de service_role. Leitura/RPC financeira e ocupação conservam os locks de integridade.                                                                                                                                                                                                              |
| Desempenho       | EXPLAIN ANALYZE em 10 mil despesas fictícias confirmou uso de `expenses_period`. Smoke standalone registra ativos/fontes e latência local aquecida. Não equivale a teste de carga, p95 público ou comparação de produção.                                                                                                                                                                                 |

Os SQLs anteriores foram preservados. Sem projeto/stack real, não foram executados advisors Supabase, pgTAP/PostgreSQL 17, Storage HTTP nem revisão de políticas preexistentes. A versão local isolada é PostgreSQL 18.4.

## Comandos locais

```sh
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run check:security
npm run check:api
npm test
npm run test:db
npm audit --audit-level=high
npm run build
npm run test:standalone
npm run test:e2e
```

`check:security` atualiza o inventário estático. `check:api` falha se método API ficar sem contrato ou referência inválida. `node scripts/generate-business-api.mjs` regenera schemas estruturais a partir de Zod; refinamentos e regras SQL continuam descritos nos guias. As novas dependências swagger-parser/yaml são só de desenvolvimento.

`npm start` usa o servidor standalone e prepara os assets estáticos; aceita `--hostname` e `--port`. `test:standalone` inicia o servidor do pacote em porta local temporária, verifica liveness, arquivos estáticos, fonte e licença OFL; encerra o processo e grava `output/standalone-smoke.json`. O pacote foi exercitado no Windows/Node 24. A imagem Linux precisa do ensaio Docker em homologação.

## Readiness e bloqueio de promoção

`GET /api/v1/health` continua sendo liveness público, sem prova de dependências. O novo `GET /api/internal/readiness` exige `Authorization: Bearer <READINESS_SECRET>` distinto dos demais segredos e com mínimo de 32 caracteres. Não configurar esse segredo no navegador.

Sem segredo, retorna 503; Bearer incorreto, 401. Quando autorizado, retorna somente `status` e checks booleanos de configuração, Auth health HTTP, banco, schema, RLS das tabelas e privacidade dos quatro buckets. Consultas têm timeout de 5 segundos. Não altera dados. Um 200 não comprova entrega de email, upload/download Storage real, restauração ou aceite operacional.

```sh
npm run deploy:check
```

Esse comando lê o ambiente local sem imprimir valores e retorna código diferente de zero quando faltam origens HTTPS, chaves, Turnstile ou segredos distintos. Recusa chave de serviço no campo público, timezone inválido e provedor de email parcialmente configurado. Aqui a verificação **recusou a promoção por ausência de configuração**, como esperado. O código não cria um bypass da proteção quando faltam credenciais.

Validar conectividade com readiness é um passo adicional; a aprovação sintática não libera produção por si só. Segredos e checagens de aceite devem ser fornecidos pelo responsável no gerenciador do ambiente, sem envio pelo chat.

## Supabase local completo e HTTP real

O workflow [database.yml](../.github/workflows/database.yml) foi preparado para PostgreSQL 17 local: start/reset exclusivo do container descartável, lint, pgTAP 001–008, cenários SQL completos, geração de tipos e smoke Auth/SSR/RBAC/PostgREST/Storage. **Esse workflow não foi executado nesta máquina, que não tem Docker.** Não interpretar sua presença como resultado aprovado.

Em workspace exclusivo de testes, depois de instalar Docker e CLI 2.121.0:

```sh
supabase start
supabase db reset --local
supabase db lint --local --level error
supabase test db --local
```

O reset acima é somente para stack local descartável. Nunca executar contra banco persistente ou remoto. Os passos seguintes modificam apenas fixtures locais e recusam destinos fora de loopback:

```powershell
New-Item -ItemType Directory -Force .database-tests
supabase status -o env | Set-Content -Encoding utf8 .database-tests/local.env
$env:E2E_LOCAL_DISPOSABLE = 'yes'
node scripts/test-local-supabase.mjs
node scripts/bootstrap-local-e2e.mjs
npm run build
npm run test:supabase:http
```

`local.env` e `.env.local` contêm chaves locais e ficam ignorados; não imprimir ou anexar. O bootstrap cria três usuários fictícios confirmados via Auth admin, ativa seus perfis/cargos e cria `.env.local` com flag `wx`, recusando sobrescrita. Não envia email e não apaga usuários automaticamente: o encerramento/reset da stack descartável limpa fixtures. Rodar em checkout novo, sem configuração existente. No Linux, o workflow grava o arquivo diretamente, sem mostrar seu conteúdo.

`playwright.supabase.config.ts` inicia o app em porta 3200, exige loopback e `E2E_LOCAL_DISPOSABLE=yes`. A suíte cobre login/logout real, cookies HttpOnly, persistência SSR, domínios FINANCE/ATTENDANT, INSERT direto em ledger e acesso anônimo ao Storage. Trace/vídeo/screenshot ficam desabilitados para não capturar credenciais. Falta de configuração falha explicitamente, sem testes ignorados marcados como sucesso.

Essa suíte HTTP é um smoke. O **percurso comercial completo no navegador** abaixo continua sendo critério de homologação; os cenários SQL existentes exercitam o ciclo de negócio, mas não comprovam todas as telas e integrações HTTP em conjunto.

## Percurso obrigatório antes do uso comercial

Executar em projeto de homologação separado, com usuários fictícios por cargo, tokens revogados, storage privado, provedor controlado e Turnstile de homologação. Não ativar chaves de teste em produção.

1. Login ADMIN, criação de categoria/frota/unidade/cliente/condutor; conferir CPF/CNPJ/CNH e concorrência de edição.
2. Configurar preços/políticas, identidade da locadora, limites, checklist e contrato com textos aprovados; gerar tipos oficiais do banco.
3. Publicar site, aceitar política versionada, realizar cotação e pedido público usando Turnstile real; consultar protocolo por token, com falha uniforme para token incorreto.
4. Login MANAGER, aprovar reserva, disputar mesmo veículo em duas sessões e confirmar apenas um vencedor.
5. Converter sem liberar ocupação; cadastrar logística, condutores, documentos e vistoria inicial/fotos. Gerar PDF pelo worker e conferir arquivo privado/hash/layout/assinatura manual.
6. Login FINANCE, registrar recebimento efetivo e caução; ATTENDANT não pode confirmar caixa. Testar parcial, reembolso e aplicação/estorno sem exceder saldos.
7. Retirada bloqueada por requisito faltante; retirada válida única; prorrogação válida e conflitante/aditivo.
8. Vistoria final/fotos, km/combustível/extras, devolução pendente de pagamento e encerramento após confirmação. Resolver caução com restituição real, sem apagar histórico.
9. Manutenção conflitante recusada; conclusão com despesa atômica; alertas por data/km/fuso; conferir caixa/notificações e relatórios/CSV de cada domínio.
10. Revogar perfil/sessão no meio do uso; testar chamada direta PostgREST e URLs Storage com usuário alheio, sem service key no cliente.
11. Exercitar perda de resposta/lease, provider 429/5xx, DEAD, reconciliação e jobs concorrentes; verificar ausência de PII nos logs.
12. Revisar acessibilidade das telas autenticadas, leitor de tela, teclado, celular e desempenho com volume/conexões realistas; ensaiar backup/restauração/rollback.

Responsável deve registrar resultado, versão da imagem/código, migration, navegador, dados fictícios e evidência mínima de cada passo. Nenhum desses passos externos foi marcado como concluído apenas por esta entrega local.

## Empacotamento e deploy

O Next.js usa `output: standalone`, com fonte Noto Sans e licença OFL incluídas. O [Dockerfile](../Dockerfile) é multistage, Node 24.20.0 Debian slim, runtime sem root e healthcheck de liveness. `.dockerignore` exclui segredos, caches e artefatos. Testes continuam no estágio de build para o typecheck; somente o trace standalone e assets entram no runtime.

Os quatro valores NEXT_PUBLIC usados no build são públicos. Valores privados entram **somente no runtime** por gerenciador de segredos/arquivo ignorado. Não passar service role, AUTH_SECRET ou chaves de worker como build-arg. Imagens de homologação e produção precisam ser construídas com seus respectivos valores públicos, que ficam incorporados pelo Next.js.

Exemplo PowerShell, após configuração/aceite de homologação:

```powershell
docker build -t locadora-pro:homologacao `
  --build-arg NEXT_PUBLIC_APP_URL=$env:NEXT_PUBLIC_APP_URL `
  --build-arg NEXT_PUBLIC_SUPABASE_URL=$env:NEXT_PUBLIC_SUPABASE_URL `
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY `
  --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=$env:NEXT_PUBLIC_TURNSTILE_SITE_KEY .
docker run --name locadora-pro-hml --env-file .env.production.local -p 127.0.0.1:3000:3000 locadora-pro:homologacao
```

Esses comandos são preparação e não foram executados sem Docker. Fixar a imagem base por digest aprovado pelo responsável, fazer scan da imagem Linux e registrar o digest final antes de promover. Publicar atrás de proxy HTTPS, com limites de corpo/tempo, controle de taxa e encaminhamento de origem confiável; não expor a porta Node diretamente. Configurar `NEXT_PUBLIC_APP_URL` para a origem canônica e evitar cache de Auth/admin/consulta por token/relatórios.

Para múltiplas réplicas: mesmo `AUTH_SECRET` e chaves internas por ambiente, banco compartilhado e jobs protegidos por lease; alinhar a chave de criptografia de Server Actions/identidade da build conforme o provedor Next.js. Não misturar instâncias de builds diferentes durante requisições de Action sem estratégia de compatibilidade. Domínio, hospedagem, orçamento, repositório Git/remoto e credenciais de deploy ainda não foram definidos; nenhum provedor foi contratado.

## Promoção, rollback e recuperação

1. Registrar release/digests, 25 migrations, checksum dos assets, checklist de aceite e responsáveis. Fazer backup verificado do banco **e** exportação dos objetos privados/manifesto; backup SQL sozinho não contém os bytes do Storage.
2. Ensaiar restauração em ambiente separado com os mesmos objetos, FKs, RLS e contratos; comparar contagens, hashes e autorização. Definir RPO/RTO, retenção e tratamento de PII com a empresa; não inventar metas.
3. Revisar `supabase db push --dry-run` no projeto explicitamente selecionado, aplicar somente migration nova, executar lint/pgTAP/advisors e verificar índices/prontidão. Em tabelas grandes, planejar janela/estratégia de criação de índices; a migration 25 usa CREATE INDEX transacional, que pode bloquear escrita.
4. Implantar a imagem aprovada em homologação, conferir readiness e executar o percurso. Configurar dois jobs POST separados e monitor privado GET; não colocar segredos na URL ou logs. Confirmar entrega/custo/limites de email e alertas para atraso/falha de fila.
5. Promover só após aceite. Monitorar erros, conflitos, backlog, locks, latências, arquivos pendentes e compensações financeiras.
6. Rollback de código: voltar ao digest anterior compatível, manter migrations aditivas/ledgers e retomar jobs com leases/chaves estáveis. Não fazer down destrutivo, reset ou apagar cobranças para “voltar” uma release. Reconciliar falhas antes de retentar email fora da janela de idempotência.
7. Em incidente: pausar agendadores pelo provedor, limitar acessos, preservar evidências sem PII nos logs, revogar credenciais comprometidas, restaurar somente com plano aprovado e validar novamente. Limpar tokens de acesso não substitui revogação de sessões conforme as regras Auth existentes.

Não houve ensaio de restauração, deploy, configuração de agendador ou disparo real de email aqui. Esses são gates de promoção, não falhas escondidas no resultado dos testes locais.

Fontes: [Next.js standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [ambientes Supabase](https://supabase.com/docs/guides/deployment/managing-environments). Evidências e limitações devem acompanhar qualquer promoção.
