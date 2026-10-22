# Configurar e verificar o Supabase

**Estado remoto atual — 22/10/2026:** o projeto autorizado já recebeu 26 migrations, com 64 tabelas sob RLS e quatro buckets privados. A suíte isolada passou com 81 cenários; dez verificações SQL de leitura passaram no PostgreSQL 17.11 remoto. Auth básico e chave de servidor foram configurados, o primeiro ADMIN está ativo e seu primeiro login real foi confirmado. Renovação/logout, demais cargos e fluxos de negócio ainda precisam de homologação; recuperação de senha foi adiada por decisão do usuário sobre SMTP. Consulte [supabase-project.md](../supabase-project.md); os estados por fase abaixo são históricos. Não repetir push/reset das migrations aplicadas.

Atualização da Fase 9: há **25 migrations e 64 tabelas**, aplicadas do zero em PostgreSQL 18.4 isolado, com 80 cenários aprovados. A migration 25 acrescenta índices e prontidão privada. pgTAP 008, workflow PostgreSQL 17 e smoke Auth/SSR/PostgREST/Storage foram preparados, mas não executados sem Docker/stack. Procedimento atual em [phase-9.md](../phase-9.md). O estado por fase abaixo é histórico.

## Estado da entrega

Há 24 migrations SQL, 64 tabelas da aplicação, políticas RLS, funções transacionais, projeções e quatro buckets privados. A sequência foi aplicada do zero em PostgreSQL 18.4 isolado, com 78 cenários aprovados. As 22–24 acrescentam financeiro compensatório, manutenção/relatórios e entrega de notificações, preservando as 01–21. Não foi aplicado SQL remoto. Configuração e homologação da Fase 8 em [business-operations.md](../business-operations.md); locações/contratos em [rentals.md](../rentals.md) e fases anteriores em [registry.md](../registry.md), [reservations.md](../reservations.md) e [public-site.md](../public-site.md).

O teste isolado usa um **shim exclusivo de teste** para os contratos SQL `auth.uid()`, `auth.jwt()`, `auth.users`, `auth.sessions`, `storage.buckets` e `storage.objects`. Não testa a validação criptográfica de JWT, a API Auth, o HTTP PostgREST, arquivos, URLs assinadas nem o processo de migrations interno do Supabase. A versão alvo no `config.toml` é PostgreSQL 17; a validação nessa versão é responsabilidade do workflow Supabase abaixo e da homologação local.

## Opção 1 — PostgreSQL isolado, sem Supabase/Docker

```sh
npm ci
npm run test:db
```

O comando ignora qualquer DATABASE_URL existente, escolhe uma porta em loopback e cria um cluster novo em `.database-tests/run-<uuid>`. Não cria usuários do sistema, não conecta a servidores externos e não reseta bancos existentes. O servidor é encerrado ao final; os diretórios de teste permanecem ignorados pelo Git para diagnóstico. `.database-tests/latest-result.json` contém o recibo da última execução bem-sucedida, com identificador único; não interpretar um recibo antigo como resultado atual.

Dependências somente de desenvolvimento: `pg@8.23.1` e `embedded-postgres@18.4.0-beta.17`. O PostgreSQL empacotado é 18.4; o wrapper é beta. Foi inspecionado antes do uso e fica fora do runtime de produção. A supervisão exige recibo de sucesso porque o exit hook do wrapper pode sobrescrever o exit code. No Windows restrito, iniciar processos/consultar o usuário pode exigir autorização do executor. Em Linux não executar como root; `createPostgresUser` permanece false e nenhum usuário do sistema é criado.

O pacote nativo pode exigir seu script oficial de hidratação de symlinks no Linux/macOS. Revise `npm install-scripts ls` e autorize somente o pacote nativo correspondente se seu npm bloquear install scripts. No Windows utilizado nesta entrega a lista de symlinks do pacote é vazia.

## Opção 2 — Supabase local completo (ainda depende de configuração)

Pré-requisitos: Docker Desktop/Engine funcionando, CLI Supabase **2.121.0** no PATH e portas locais disponíveis. Instale a CLI pelos meios oficiais; não é necessário instalar Supabase globalmente via npm. `supabase/config.toml` já está preparado com PostgreSQL 17, cadastro público desabilitado e seeds automáticos desabilitados.

```sh
supabase start
supabase db reset --local
supabase db lint --local --level error
npm run test:db:supabase
```

`db reset --local` descarta o banco local da stack; use apenas no ambiente descartável de desenvolvimento. Não usar `--linked` ou URL remota para reset/teste. A suíte pgTAP em `supabase/tests/database` usa BEGIN/ROLLBACK e dados explicitamente fictícios. O workflow `.github/workflows/database.yml` prepara essa stack em runner descartável, reaplica migrations, executa pgTAP e gera tipos. O workflow foi preparado, mas ainda não foi executado no GitHub nesta entrega.

### Tipos TypeScript

Depois de aplicar o schema e validar os testes:

```sh
supabase gen types typescript --local --schema public > src/types/database.generated.ts
```

Crie `src/types` se necessário. No PowerShell antigo, use `Out-File -Encoding utf8` para evitar saída UTF-16. Não criar tipos manuais fingindo que vieram do banco. Os tipos oficiais permanecem pendentes até a stack completa estar disponível; depois tipar os três clientes Supabase com `Database`. O CI gera o arquivo como artifact para revisão; não publica nem aplica migrations remotamente.

### Bootstrap do primeiro ADMIN

1. Criar o funcionário no Supabase Auth por um canal administrativo. O trigger cria `profiles.active=false`; metadados enviados no cadastro nunca concedem cargo.
2. Usar uma conexão SQL privilegiada para associar **o UUID real desse usuário** ao papel ADMIN e ativar o profile na mesma transação. Exemplo com variável psql:

```sql
begin;
insert into public.user_roles(user_id,role_id)
select :'user_id'::uuid,id from public.roles where code='ADMIN';
update public.profiles set active=true where id=:'user_id'::uuid;
commit;
```

3. Configurar o fluxo Auth da Fase 3 conforme `../authentication.md` e verificar identidade/permissões antes de liberar o painel. Sem configuração o app continua fechado; com configuração o painel exige funcionário ativo, cargo e sessão válida.

Não existe RPC pública de bootstrap. Após o primeiro ADMIN, `set_staff_access` exige `users.manage`, serializa alterações, atribui um único perfil por chamada e impede remover o último ADMIN ativo. `user_roles` permite evolução futura, mas nenhuma escrita direta é concedida a authenticated.

### Buckets e chaves

`vehicle-images`, `documents`, `inspections` e `contracts` são privados. As migrations abortam se um bucket homônimo preexistente estiver público, em vez de reduzir silenciosamente sua proteção. Revisar buckets/policies existentes antes de usar um projeto compartilhado; recomenda-se projeto exclusivo para a aplicação. Não expor `app_private` nos schemas da Data API.

Preencher `.env.local` com URL e chave publicável do projeto. A chave de serviço é exclusiva do servidor e bypassa RLS; não é cliente padrão de CRUD. Para testar RLS, usar chave publicável e sessão do funcionário, nunca service role. Não há escrita pública em clientes/reservas/orçamentos nesta fase: o endpoint futuro precisará limitar spam e calcular preços antes de receber execução privilegiada.

As policies Storage exigem metadado SQL e caminho `<UUID da entidade>/<UUID do arquivo>.<extensão>`. UPDATE/upsert/DELETE não são concedidos a funcionários. Contratos só são inseridos pelo worker privilegiado; leitura somente após geração. Upload real deve verificar conteúdo, tamanho e MIME na API e na configuração de bucket. URLs assinadas só serão emitidas após autorização de servidor nas fases de documentos/vistorias.

### Seed de desenvolvimento

O catálogo estrutural de papéis/permissões faz parte da migration 02. A fixture `supabase/seeds/development.sql` é separada, não automática e recusa execução sem `SET LOCAL app.environment='development'`. Se for necessária, executar **somente em conexão local de desenvolvimento**, em uma transação que define essa configuração e aplica o arquivo. Essa configuração é uma trava contra acidente, não uma prova de que o banco é de desenvolvimento. Nunca incluir seeds de negócio em push remoto.

## Projeto remoto de desenvolvimento/homologação

Depende de projeto, credenciais e seleção explícita do ambiente. Não foram fornecidos nem usados nesta entrega. Após backup, revisão das policies e validação local, o responsável pode vincular o projeto correto e revisar `supabase db push --dry-run`; aplicar somente migrations novas. Não usar a service key como senha de PostgreSQL e não incluir segredos no comando ou no repositório.

## O que ainda depende do Supabase

- Aplicação pelo mecanismo real de migrations no PostgreSQL 17 e execução da suíte pgTAP/lint.
- Geração oficial dos tipos e uso de `Database` nos clientes.
- Testes HTTP de acesso direto ao PostgREST com JWT de cada perfil, tokens expirados e sessões revogadas.
- Homologação HTTP Auth/refresh/logout/recuperação da Fase 3 e configuração de origens/SMTP; ver `../authentication.md`. MFA permanece sem implementação.
- Upload/download/MIME/limites/URLs assinadas no Storage real e revisão de policies preexistentes.
- Configuração de segredos, backups, restauração, retenção e monitoramento do ambiente.

Fontes oficiais: [migrations](https://supabase.com/docs/guides/deployment/database-migrations), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [testes](https://supabase.com/docs/guides/local-development/testing/overview), [setup CLI no CI](https://github.com/supabase/setup-cli).
