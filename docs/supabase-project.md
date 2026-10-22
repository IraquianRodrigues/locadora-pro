# Supabase do Locadora Pro — configuração remota

Atualizado em 22/10/2026. Projeto autorizado: **locadora-pro**, referência `zfvqvzhajnjwpsbajqux`, região `us-east-2`, PostgreSQL **17.11**. A conexão administrativa confirmou que o projeto não tinha migrations, tabelas públicas, usuários Auth nem buckets antes desta configuração.

## Aplicado e verificado

- As 25 migrations existentes e a nova **26 — finance_projection_security** foram aplicadas pelo mecanismo de migrations do Supabase. Há **64 tabelas, todas com RLS**, 96 policies nos schemas público/Storage e quatro buckets privados: `vehicle-images`, `documents`, `inspections`, `contracts`, com MIME e limites definidos nas migrations.
- As cinco views financeiras usam `security_invoker=true`. Quatro consultam funções privadas com retorno limitado e verificação da permissão/sessão atual; isso preserva as projeções FINANCE sem abrir CPF, endereço, placa ou documentos. O saldo continua protegido por RLS e cálculo autorizado.
- Um índice duplicado foi removido, mantendo a cobertura da FK; três FKs ganharam índices. O advisor de performance passou a indicar somente índices ainda não usados, esperado em banco recém-criado.
- `operational_readiness()` confirmou `schema`, `storage` e `rls` verdadeiros. Dez verificações SQL de leitura passaram: tabelas, RLS, views, buckets, grants da prontidão, isolamento do schema privado, search_path, ausência de EXECUTE implícito de PUBLIC, cargos e exclusão de alocações. SQL reproduzível em [remote-readonly.sql](../supabase/verification/remote-readonly.sql).
- O advisor de segurança não tem mais achados de nível ERROR. Permanecem avisos de EXECUTE das cinco RPCs públicas de catálogo e das 40 RPCs autenticadas previstas na arquitetura. As quatro tabelas internas sem policies são deliberadamente fechadas aos clientes, com RLS e sem grants diretos; não criar policies permissivas para silenciar esse aviso. Esses avisos não equivalem a uma certificação de segurança. [Entenda os avisos de funções](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- Tipos oficiais foram gerados no projeto, após a migration 26, em [database.generated.ts](../src/types/database.generated.ts). A tipagem genérica dos clientes existentes continua uma melhoria separada; não foi reescrita nesta configuração.
- `.env.local` foi criado, ignorado pelo Git, com a origem Supabase **sem `/rest/v1/`**, a chave `anon` fornecida e quatro segredos locais independentes e aleatórios. Nenhum segredo foi gravado na documentação ou no arquivo de exemplo. Origem atual da aplicação: `http://localhost:3000`.

O MCP atribuiu timestamps próprios ao aplicar as migrations. O histórico foi alinhado aos 26 arquivos locais em uma operação atômica, somente após comparar nome, quantidade e conteúdo exato de cada SQL com o MD5 do arquivo. Nenhum corpo SQL foi reexecutado ou alterado nessa etapa. [Manifesto](database/remote-migrations.json) registra versões iniciais/remapeadas e hashes para continuidade com a CLI. Não reaplicar as migrations já registradas e não fazer reset remoto.

## Evidências desta execução

| Verificação                          | Resultado                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Banco isolado, 26 migrations do zero | **81 cenários aprovados**, PostgreSQL 18.4; recibo `fdaa0ca0-ad5c-45a9-aa04-7d24082e9236`                                       |
| Projeto remoto PostgreSQL 17.11      | 26 migrations aplicadas e dez verificações SQL de leitura aprovadas; não é a suíte pgTAP completa                               |
| Build com URL/chave reais            | Aprovado; chave pública incorporada no bundle                                                                                   |
| TypeScript após tipos gerados        | Aprovado na verificação executada                                                                                               |
| Segurança estática                   | 170 módulos e 30 rotas, sem achados nas regras implementadas                                                                    |
| HTTP público direto                  | Auth acessível; consultas anônimas a profiles/customers/vehicles/payments não retornam dados; prontidão negada; buckets ocultos |
| Gate de deploy                       | Corretamente bloqueado: origem ainda HTTP local, chave de serviço e duas chaves Turnstile ausentes                              |

O script `node scripts/verify-remote-supabase.mjs` só lê endpoints do projeto e grava um recibo sem tokens em `output/supabase-remote-verification.json`. Na retomada de 22/10, suas nove verificações passaram, incluindo cadastro público desabilitado, sign-ins anônimos desabilitados, ausência de dados nas quatro consultas anônimas verificadas e recusa/ocultação de prontidão e buckets. A checagem de tabelas vazias não substitui testes de isolamento com dados e JWTs de cada cargo. Não foram criadas fixtures, usuários fictícios ou arquivos no projeto remoto. Os 40 testes locais de autenticação/ambiente também passaram nesta retomada; não comprovam login real ou entrega de e-mail. As 149 verificações unitárias e os 46 testes de navegador da Fase 9 são evidências anteriores, não foram repetidos nesta configuração.

## Auth configurado e etapas ainda pendentes

A sessão do painel foi concluída com GitHub. As configurações abaixo foram conferidas no projeto autorizado; não houve reset ou reaplicação de migrations. Não enviar senha ou chave secreta no chat.

1. **Auth — aplicado:** novos cadastros desabilitados; sign-ins anônimos e vinculação manual desligados; somente Email habilitado, com confirmação de e-mail mantida. Senha mínima de 12 caracteres, com maiúscula, minúscula, número e símbolo, salva e conferida no painel. Site URL `http://localhost:3000` e os dois redirects exatos `http://localhost:3000/auth/confirm` e `http://localhost:3000/auth/callback` conferidos. Trocar pela origem HTTPS real no deploy, sem wildcard. Sessões mantêm access token de 3600 segundos, detecção de reutilização de refresh tokens ligada e intervalo de reutilização de 10 segundos. Opções avançadas de duração/inatividade e proteção de senhas vazadas estão limitadas ao plano Pro; nenhum upgrade foi contratado.
2. **Chave de servidor — configurada:** a chave fornecida pelo usuário foi validada para o projeto autorizado, salva somente em `.env.local` e aceita em leituras administrativas e na RPC de prontidão. O arquivo continua ignorado pelo Git; o segredo não foi incluído na documentação. Como a credencial foi compartilhada no chat, recomenda-se substituí-la por canal privado, validar a substituta e planejar a desativação da antiga sem interromper outros consumidores. Nenhuma chave foi criada, rotacionada ou desativada automaticamente.
3. **Administrador — ativo, com primeiro login confirmado:** após a conta aparecer no projeto com e-mail confirmado, a ativação recebeu confirmação explícita do usuário. Uma transação SQL com validação de UUID/e-mail confirmado, bloqueio do perfil e recusa de bootstrap quando já existe outro ADMIN ativou o perfil e atribuiu o cargo. Uma leitura independente pela API confirmou `active=true` e exatamente um cargo, `ADMIN`. A senha foi definida privadamente pelo usuário; não foi lida nem modificada pelo agente. Não houve INSERT direto em `auth.users`, concessão por `user_metadata` ou criação de RPC pública de bootstrap. Em 22/10, o usuário confirmou a entrada na aplicação local; a API administrativa do Supabase confirmou `last_sign_in_at`, e o servidor Next registrou sucesso no POST de login e respostas 200 do dashboard protegido. A aba acessível ao agente permaneceu sem sessão, portanto não foram inspecionados cookies nem respostas autenticadas nesse navegador. Isso confirma o primeiro login real, sem representar homologação completa de refresh, logout ou dos demais cargos.
4. **Recuperação — adiada:** o painel atual exige SMTP próprio ou plano Pro para editar o template. O usuário decidiu não configurar serviço de e-mail por enquanto. Portanto, o [recovery.html](../supabase/templates/recovery.html) ainda não foi instalado, nenhum e-mail foi enviado e o fluxo completo não foi homologado. O template padrão não atende ao fluxo de confirmação da aplicação; não anunciar recuperação de senha operacional. Quando o serviço for aprovado, configurar SMTP/domínio/remetente verificados e instalar o link `/auth/confirm?token_hash=...&type=recovery`. [Templates oficiais](https://supabase.com/docs/guides/auth/auth-email-templates).

Depois disso, homologar login/logout/refresh/recovery, RBAC com quatro cargos, Storage com uploads reais e URLs assinadas, ciclo comercial completo e recuperação de backups. A suíte que reseta/semeia o Supabase local descartável **não deve ser apontada para este projeto remoto**.

### Verificações da aplicação após o bootstrap

- A aplicação local foi iniciada em `http://localhost:3000`, usando a configuração real do servidor. O primeiro login foi realizado privadamente pelo usuário e confirmado pelas evidências de Auth e HTTP descritas acima.
- Sem cookies, `/api/v1/admin/session` e `/api/internal/readiness` retornaram 401; `/admin/dashboard` redirecionou para o login. Respostas sensíveis usam `private, no-store`.
- A prontidão privada confirmou Auth, banco, schema, Storage e RLS. O resultado geral permanece 503 porque a configuração de produção ainda está incompleta; isso não indica falha dessas integrações.
- `npm run deploy:check` passou a apontar três bloqueios: origem pública HTTPS e as duas chaves Turnstile. A chave de servidor deixou de ser uma pendência.
- As nove verificações anônimas remotas passaram novamente após o bootstrap. Nenhuma delas equivale à homologação autenticada dos quatro cargos.

## Dependências externas restantes

- Domínio e hospedagem HTTPS; chaves Turnstile emitidas para os hosts reais. Não usar chaves de teste como configuração de produção.
- Resend opcional com domínio verificado e opt-in explícito das rotas de notificações.
- Agendador para os dois workers, monitor privado, retenção e política de backup do banco e dos objetos Storage, com restauração testada. Os segredos locais já existem, mas nenhum agendador ou serviço externo foi criado.
- Configurações comerciais reais pelo painel: empresa/unidades, tarifas, frota, modelos e revisão dos contratos, políticas operacionais. O catálogo público segue fechado até publicação explícita; nenhum dado comercial foi inventado.

Não houve deploy da aplicação nem liberação para operação comercial. Os documentos de fases anteriores permanecem como histórico; este arquivo registra o estado remoto atual.
