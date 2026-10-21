# Supabase do Locadora Pro — configuração remota

Atualizado em 20/10/2026. Projeto autorizado: **locadora-pro**, referência `zfvqvzhajnjwpsbajqux`, região `us-east-2`, PostgreSQL **17.11**. A conexão administrativa confirmou que o projeto não tinha migrations, tabelas públicas, usuários Auth nem buckets antes desta configuração.

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

O script `node scripts/verify-remote-supabase.mjs` só lê endpoints do projeto e grava um recibo sem tokens em `output/supabase-remote-verification.json`. **Ainda termina com falha porque o cadastro público do Auth está habilitado.** A checagem de tabelas vazias não substitui testes de isolamento com dados e JWTs de cada cargo. Não foram criadas fixtures, usuários fictícios ou arquivos no projeto remoto. As 149 verificações unitárias e os 46 testes de navegador da Fase 9 são evidências anteriores, não foram repetidos nesta configuração.

## Aguardando login no painel

A conexão administrativa disponível oferece banco/migrations/advisors/tipos, mas não configura Auth nem fornece a chave de servidor. O painel foi aberto na aba do navegador da tarefa e ainda exibe login. A autenticação nessa aba é necessária para concluir os itens seguintes; não enviar senha ou chave secreta no chat.

1. **Auth:** desabilitar novos cadastros; manter sign-ins anônimos desligados; manter somente os provedores usados. Exigir senha de 12 caracteres com maiúscula, minúscula, número e símbolo. Configurar Site URL `http://localhost:3000` e redirects exatos `http://localhost:3000/auth/confirm` e `http://localhost:3000/auth/callback` para a etapa local. Trocar pela origem HTTPS real no deploy, sem wildcard.
2. **Chave de servidor:** preencher `SUPABASE_SERVICE_ROLE_KEY` diretamente em `.env.local`, somente no servidor. A chave pública não permite substituir essa chave. Login da aplicação usa limitador privilegiado e permanece indisponível enquanto ela estiver ausente.
3. **Administrador:** o e-mail indicado pelo usuário está reservado para bootstrap, mas ainda não existe usuário Auth. Criá-lo pelo canal administrativo com e-mail confirmado; senha definida privadamente. Depois ativar o UUID real e atribuir ADMIN pela transação de [setup.md](database/setup.md). Não criar identidades diretamente com INSERT em `auth.users`; não atribuir cargos via user_metadata.
4. **Recuperação:** instalar [recovery.html](../supabase/templates/recovery.html) como template Reset password, mantendo o link `/auth/confirm?token_hash=...&type=recovery`. Configurar SMTP/domínio/remetente verificados. Não foi enviado convite nem e-mail nesta execução. [Templates oficiais](https://supabase.com/docs/guides/auth/auth-email-templates).

Depois disso, homologar login/logout/refresh/recovery, RBAC com quatro cargos, Storage com uploads reais e URLs assinadas, ciclo comercial completo e recuperação de backups. A suíte que reseta/semeia o Supabase local descartável **não deve ser apontada para este projeto remoto**.

## Dependências externas restantes

- Domínio e hospedagem HTTPS; chaves Turnstile emitidas para os hosts reais. Não usar chaves de teste como configuração de produção.
- Resend opcional com domínio verificado e opt-in explícito das rotas de notificações.
- Agendador para os dois workers, monitor privado, retenção e política de backup do banco e dos objetos Storage, com restauração testada. Os segredos locais já existem, mas nenhum agendador ou serviço externo foi criado.
- Configurações comerciais reais pelo painel: empresa/unidades, tarifas, frota, modelos e revisão dos contratos, políticas operacionais. O catálogo público segue fechado até publicação explícita; nenhum dado comercial foi inventado.

Não houve deploy da aplicação nem liberação para operação comercial. Os documentos de fases anteriores permanecem como histórico; este arquivo registra o estado remoto atual.
