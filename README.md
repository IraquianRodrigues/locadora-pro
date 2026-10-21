# Locadora Pro

Sistema de locação para uma única empresa brasileira. **Fases 0–8 implementadas e preparação local da Fase 9 entregue**: Auth/RBAC, cadastros, catálogo/reservas, locações/vistorias/PDF, financeiro/manutenção, relatórios e notificações. São 26 migrations e 64 tabelas, já aplicadas no projeto Supabase autorizado. A configuração de Auth/chave de servidor aguarda acesso ao painel; testes autenticados, serviços externos e liberação comercial continuam dependendo de homologação. Estado atual em [Configuração do projeto Supabase](docs/supabase-project.md).

## Documentação

- [Diagnóstico do ambiente](docs/architecture/environment.md)
- [Arquitetura e estrutura final](docs/architecture/overview.md)
- [Decisões e pendências](docs/architecture/decisions.md)
- [Modelo de dados e plano de migrations](docs/database/schema.md)
- [Configuração Supabase e testes de banco](docs/database/setup.md)
- [Políticas, grants e funções transacionais](docs/database/policies.md)
- [ER completo proposto](docs/database/erd.md)
- [Reservas e fluxo de aprovação](docs/business-rules/reservations.md)
- [Tarifas](docs/business-rules/pricing.md) e [locações](docs/business-rules/rentals.md)
- [Permissões](docs/security/permissions.md) e [segurança](docs/security.md)
- [Contrato OpenAPI inicial](docs/api/openapi.yaml)
- [Backlog e critérios de aceite](docs/backlog.md)
- [Deploy](docs/deployment.md)
- [Execução e verificações desta entrega](docs/verification.md)
- [Entrega e evidências da Fase 2](docs/database/phase-2.md)
- [Autenticação, configuração e homologação da Fase 3](docs/authentication.md)
- [Cadastros, arquivos privados e homologação da Fase 4](docs/registry.md)
- [Tarifas, cotações, reservas e homologação da Fase 5](docs/reservations.md)
- [Catálogo, antispam e configuração pública da Fase 6](docs/public-site.md)
- [Locações, vistorias, contratos e configuração da Fase 7](docs/rentals.md)
- [Financeiro, manutenção, relatórios, notificações e configuração da Fase 8](docs/business-operations.md)
- [Fase 9: segurança, testes, deploy e rollback](docs/phase-9.md)
- [Matriz de aceite e pendências externas](docs/acceptance.md)

## Desenvolvimento

Use Node 24 LTS e npm. Dependências fixadas no `package-lock.json`.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

No PowerShell, use `Copy-Item .env.example .env.local`. Abra http://localhost:3000. Sem credenciais, o site funciona em preparação, os formulários Auth ficam desabilitados e `/admin` permanece fechado. Com configuração completa, somente funcionários ativos com cargo e sessão válidos acessam o painel.

```sh
npm run lint
npm run typecheck
npm run check:security
npm run check:api
npm run format:check
npm test
npm run test:db
npm run build
npm run test:standalone
npm run test:e2e
```

Para E2E, instale o Chromium com `npx playwright install chromium`. A suíte usa o build de produção e porta 3100. Nenhum teste desta fase comprova persistência ou segurança de módulos ainda não implementados.

## Configuração

Preencha as variáveis Supabase somente em `.env.local` ou no gerenciador de segredos do ambiente. URL e chave publicável são destinadas ao cliente; a chave de serviço é exclusivamente do servidor. Não é necessária para navegar pela fundação. Nunca envie credenciais pelo chat ou faça commit delas.

Antes de conectar dados reais: aplicar e validar migrations/RLS na stack Supabase, gerar tipos e homologar Auth/SMTP/Storage/Turnstile e as matrizes de aceite. A service key fica só no servidor para processos delimitados; CRUD/decisões usam sessão e RLS/RPC autorizada. `AUTH_SECRET` assina recovery e protege hashes/tokens. `RENTAL_JOBS_SECRET`, `OPERATIONS_JOBS_SECRET` e `READINESS_SECRET` devem ser distintos; jobs são POST autenticados e monitor é GET privado. `npm run test:db` inicia PostgreSQL descartável e nunca usa DATABASE_URL. Veja [phase-9.md](docs/phase-9.md).

## Próxima entrega

Provisionar homologação e executar a matriz de aceite com Supabase/PostgreSQL 17, Auth/Storage/Turnstile e emails reais. Configurar jobs, segredos, backups/restauração e hospedagem antes de promover. `npm run deploy:check` recusa promoção sem configuração. O Dockerfile está preparado, mas não houve build de imagem ou deploy sem Docker/provedor definidos. Roteiro em [phase-9.md](docs/phase-9.md).
