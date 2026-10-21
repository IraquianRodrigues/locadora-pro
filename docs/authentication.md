# Autenticação e autorização — Fase 3

Complemento da Fase 4: cadastros e arquivos estão em [registry.md](registry.md). A chave de serviço também participa do upload validado/compensação e dos metadados delimitados desse pipeline. CRUDs e emissão de links usam sessão e RLS. O estado atual é 15 migrations/54 tabelas; quantidades abaixo descrevem a entrega da Fase 3.

## Entrega

Login por e-mail/senha, logout da sessão atual, recuperação por e-mail, atualização de senha e encerramento global após recuperação. Formulários React Hook Form com Zod compartilhado; validação e autorização repetidas no servidor. Não existe cadastro público de funcionário.

O proxy renova cookies e valida acesso antes do streaming do painel. Páginas, API e ações verificam a autorização novamente. `getUser()` valida a identidade no Supabase; `staff_context()` consulta perfil ativo, cargos, permissões e sessão no banco. Não usamos `getSession()`, metadata, localStorage, cookies de cargo nem headers do navegador para conceder acesso. Não há cache compartilhado de permissões.

A migration **13** acrescenta as RPCs Auth e exige uma linha válida em `auth.sessions`, pertencente ao usuário e com `not_after` ausente ou futuro. Sua ausência após logout também nega RLS, mesmo antes de expirar o access token. As migrations 01–12 foram preservadas. Não expor `app_private` pela Data API. A dependência de `auth.sessions`/`auth.jwt()` deve ser validada na versão real do Supabase antes de promoção.

Rotas entregues:

| Entrada                 | Comportamento                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `/login`                | Login real; erro uniforme para credencial inválida ou perfil não liberado                     |
| `/recuperar-senha`      | Resposta condicional uniforme, sem consultar existência de conta                              |
| `/auth/confirm`         | GET apenas apresenta confirmação; POST valida `token_hash` como `recovery`                    |
| `/atualizar-senha`      | Exige identidade, permissão de painel e autorização curta de recuperação                      |
| `/auth/callback`        | Troca PKCE de código por sessão; valida funcionário; nunca concede autorização de recuperação |
| `/admin/dashboard`      | Contagens reais pela RLS; visão operacional ou financeira conforme permissões                 |
| `/admin/usuarios`       | Apenas `users.manage`; consulta paginada e atribuição/revogação via `set_staff_access`        |
| `/api/v1/admin/session` | Contexto mínimo, sem tokens; 401, 403 ou 503 quando negado                                    |

Não há endpoints de negócio fictícios. Módulos futuros continuam pendentes. No dashboard, contagens de cobranças/recebimentos são quantidade de registros, sem afirmar saldo ou receita.

## Configuração obrigatória

Preencher `.env.local` ou segredos de hospedagem; nunca colocar valores reais em `.env.example`:

| Variável                               | Uso                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                  | Origem canônica exata da aplicação, sem subdiretório; HTTPS fora de localhost/loopback |
| `NEXT_PUBLIC_SUPABASE_URL`             | Projeto correto de desenvolvimento/homologação                                         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública com RLS                                                                  |
| `SUPABASE_SERVICE_ROLE_KEY`            | Servidor exclusivamente: RPC do limitador pré-login; não faz consultas da equipe       |
| `AUTH_SECRET`                          | Aleatório, mínimo 32 caracteres, igual entre instâncias do mesmo ambiente              |

Gerar `AUTH_SECRET` localmente com `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` e guardar diretamente no gerenciador de segredos. Trocar o segredo invalida autorizações de recuperação existentes e muda os hashes do limitador; planejar a rotação para não zerar limites durante ataque. Não imprimir credenciais em logs.

As variáveis `NEXT_PUBLIC_*` são incorporadas no build: reconstruir ao mudar projeto/origem. A origem do browser deve ser exatamente a canônica, inclusive porta e `localhost` versus `127.0.0.1`. Sem configuração completa, Auth permanece desabilitado e as APIs protegidas retornam 503.

### Supabase Auth e e-mail

1. Aplicar as 13 migrations no ambiente correto; não fazer reset remoto. Validar pgTAP, lint e tipos conforme `database/setup.md`.
2. Configurar **Site URL** igual a `NEXT_PUBLIC_APP_URL`. Permitir somente os callbacks exatos `/auth/confirm` e `/auth/callback` nessa origem, sem wildcard de produção.
3. Desabilitar novos cadastros, sign-ins anônimos e provedores não usados. Confirmar e-mails dos funcionários administrativamente. Exigir senha de no mínimo 12 caracteres com maiúscula, minúscula, número e símbolo no próprio Supabase; isso também protege chamadas diretas à API Auth.
4. No template **Reset password**, copiar `supabase/templates/recovery.html`. O link deve usar `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`. O template padrão `ConfirmationURL` não concede a autorização curta exigida por esta aplicação. Não substituir por `next`/URL recebida do navegador.
5. Configurar SMTP, remetente e domínio de envio verificados para uso real. O e-mail padrão de desenvolvimento possui restrições e não comprova entrega comercial. Desativar reescrita de links/click tracking. Na stack local, inspecionar a caixa de e-mail disponibilizada pelo Supabase; `config.toml` já referencia o template. Não foi contratado nem configurado provedor externo nesta entrega.
6. Revisar expiração dos links OTP, JWT, rotação/reutilização de refresh tokens, limites do Auth e notificações de alteração de senha. `secure_password_change`/MFA exigem homologação de compatibilidade com o fluxo de recovery. MFA não foi implementado nesta fase; não habilitar exigência de AAL2 sem implementar o desafio correspondente.

O GET da confirmação não consome o link: a pessoa precisa clicar em “Continuar recuperação”. O servidor verifica OTP recovery, identidade e cargo e emite `lp-recovery`, assinado com HMAC, válido por dez minutos e vinculado a usuário e `session_id`. A tela de nova senha e a ação repetem essas verificações. Após atualização, o cookie é removido e `signOut(scope: global)` encerra sessões. Falha posterior ao salvamento é apresentada como operação parcialmente concluída, sem anunciar encerramento global confirmado.

`token_hash` é sensível mesmo sendo hash: concede o fluxo de recuperação. Não registrar query strings em proxy/CDN/APM, não adicionar analytics nessas páginas, sanitizar traces de homologação e impedir cache/CDN de respostas Auth. `Referrer-Policy: no-referrer` e `private, no-store` são aplicados. A infraestrutura de hospedagem ainda precisa configurar a retenção/sanitização desses logs. Não há integração de telemetria de terceiros nestas páginas.

### Primeiro administrador e funcionários

Criar o primeiro usuário pelo canal administrativo do Supabase, com e-mail confirmado, e executar o bootstrap SQL documentado em `database/setup.md` usando seu UUID real. O trigger cria perfis inativos; metadata nunca concede privilégios. Definir um nome de exibição pela conexão privilegiada para distinguir os funcionários na gestão de acessos; nenhum e-mail é exposto pela listagem.

Depois, o ADMIN pode ativar, revogar e atribuir um único cargo aos usuários já criados em `/admin/usuarios`. A ação exige `users.manage`, e a RPC repete a exigência no banco. A troca de cargo/perfil vale na próxima operação e preserva o último ADMIN ativo. Ao remover a própria permissão, o próximo acesso à gestão será negado. Criação/convite de novas contas continua pelo Supabase administrativo; não existe endpoint público de bootstrap.

Revogar `profiles.active` ou o cargo bloqueia a aplicação e a RLS, mas não apaga a identidade Auth. Para incidente, o responsável também deve revogar sessões no Supabase. O logout comum usa escopo `local`; demais dispositivos continuam conectados. Na indisponibilidade do Auth, a tela mostra falha e oferece nova tentativa, sem afirmar que o logout remoto ocorreu.

## Cookies, CSRF, limites e auditoria

Autenticação é mediada somente pelo servidor. Cookies do Supabase e de recovery são HttpOnly, SameSite=Lax, Path=/ e Secure em HTTPS. O cliente browser Supabase fica reservado a futuras consultas públicas: não usar sua API Auth com essa estratégia. Server Components leem cookies; proxy/actions/handlers escrevem. O proxy atualiza também o request para que o render leia a sessão renovada e preserva os cookies em redirecionamentos e respostas de erro.

Mutações usam Server Actions com proteção nativa do Next e verificação adicional de `Origin` contra a origem canônica. O destino pós-login aceita somente caminhos internos do painel. Callback GET PKCE depende do code verifier; recuperação exige POST explícito. Hospedagens com proxy reverso precisam encaminhar corretamente host/origem e cookies, sem liberar origins arbitrárias.

O limitador usa `rate_limit_buckets` com upsert atômico: login 10 tentativas/e-mail, recovery 3/e-mail, confirmação 5/token e atualização 5/usuário, por 15 minutos. Cada fluxo possui ainda limite global de 1000 tentativas/15 minutos. Chaves são HMAC, sem e-mail/IP/token em claro. Sem banco/limiter, não tenta login. Não há fallback em memória. O limite global pode restringir usuários legítimos sob ataque: revisar capacidade e aplicar proteção adicional no gateway conforme tráfego. Não confiamos em `X-Forwarded-For` sem configuração de infraestrutura.

Também é preciso configurar limites da API Auth Supabase para evitar bypass do limitador da aplicação por chamadas diretas. CAPTCHA/desafio, MFA, bloqueio por IP confiável e monitoramento externo dependem de integração posterior; não são alegados como entregues. Limpar buckets expirados por tarefa administrativa agendada e definir retenção; exemplo de operação restrita: `delete from public.rate_limit_buckets where expires_at < now() - interval '1 day'`. Não há scheduler instalado.

Login aceito, recovery confirmado, alteração de senha e logout solicitado geram eventos allowlist em `audit_logs`, com ator derivado da sessão, sem payload sensível. A auditoria Auth nativa do Supabase é a fonte para tentativas inválidas e resultado do provedor; habilitar retenção/monitoramento no projeto. O evento de logout da aplicação é registrado antes do pedido ao provedor e não comprova sozinho seu sucesso. Falha de auditoria nunca impede a tentativa de logout. As RPCs públicas de evento só aceitam eventos próprios de sessões ativas; não tratá-las como prova criptográfica de uma operação de senha específica.

## Homologação ainda dependente do Supabase

| Verificação com contas exclusivas de teste                        | Resultado exigido                                                                   |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| ADMIN, MANAGER, ATTENDANT, FINANCE ativos                         | Login; visão adequada; sem acesso indevido por URL/API/RPC                          |
| Credencial errada, e-mail ausente, perfil inativo/sem cargo       | Erro uniforme; painel e API fechados                                                |
| Alterar perfil/cargo durante sessão e manter JWT antigo           | Próxima operação negada conforme nova permissão, inclusive PostgREST direto         |
| Expirar access token e abrir painel                               | Refresh no proxy, novos cookies corretos, sem cache entre usuários                  |
| Excluir/expirar sessão e reutilizar access token                  | `staff_context`, tabelas, views e Storage negam acesso                              |
| Sair e usar voltar/recarregar/mesmo token                         | Sessão atual negada; outro dispositivo preservado no logout local                   |
| E-mail válido e desconhecido; excesso de tentativas               | Resposta condicional igual; limites no app e no Auth                                |
| Link recovery válido, vencido, reutilizado, forjado               | Somente o válido emite autorização; scanners GET não consomem OTP                   |
| Nova senha/confirmar, autorização expirada, trocar usuário/sessão | Rejeição fora das condições; sucesso exige nova senha e encerra outros dispositivos |
| Origem externa e destino de redirect adulterado                   | Nenhuma mutação autorizada nem redirect externo                                     |
| Alterar último ADMIN; tentativa por atendente                     | Rollback e 403/negação; auditoria sanitizada                                        |
| Logs, CDN e cookies reais em HTTPS                                | Sem query/token/senha, sem cache; HttpOnly/Secure/SameSite adequados                |

Não foram fornecidas credenciais ou contas Auth, nem Docker/CLI local. Portanto, SMTP/OTP real, refresh/logout HTTP, PKCE e PostgREST continuam **pendentes**, assim como pgTAP na stack PostgreSQL 17, tipos oficiais e validação visual do painel com dados reais. Os testes executáveis locais incluem adapters simulados somente nos testes, PostgreSQL real isolado com shim Auth/Storage e navegador com Auth desconfigurado. Esses testes não substituem a matriz acima. Evidências em `verification.md`.

Fontes oficiais consultadas: [SSR e cookies](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [sessões e revogação](https://supabase.com/docs/guides/auth/sessions), [templates Auth](https://supabase.com/docs/guides/auth/auth-email-templates) e [templates locais](https://supabase.com/docs/guides/local-development/customizing-email-templates).
