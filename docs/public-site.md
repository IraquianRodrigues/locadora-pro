# Fase 6 — catálogo e reservas públicas

Implementação local de 20/10/2026. Catálogo com busca/categoria/unidade/paginação, detalhe por veículo, categorias, contato, políticas, cotação e solicitação com antispam e consulta por token. As migrations **19/20** preservam as anteriores e elevam o total a **56 tabelas**. Não foi configurado projeto remoto, publicado site ou cadastrado serviço externo.

## Publicar após configurar o ambiente

1. Aplicar migrations 01–20 em homologação conforme [setup](database/setup.md), executar PostgreSQL 17/pgTAP/lint e gerar os tipos oficiais.
2. Configurar Supabase URL/chave publicável/service role, AUTH_SECRET e NEXT_PUBLIC_APP_URL canônica com HTTPS. A origem precisa coincidir com o navegador, inclusive porta em desenvolvimento.
3. Configurar um widget Cloudflare Turnstile no hostname da aplicação e preencher `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` no ambiente. Recriar o build após mudar variáveis NEXT_PUBLIC. Nenhuma chave real foi criada ou usada nesta entrega.
4. Com ADMIN, abrir **Publicação do site** (`/admin/site`), preencher nome, contato/endereço públicos e textos aprovados de locação/cancelamento/pagamento e privacidade. Publicar somente após revisão da empresa. Esses textos não são gerados pelo sistema.
5. Publicar planos e adicionais pelos respectivos cadastros. Os novos campos `public_enabled` começam **false**, inclusive em dados existentes. Configurar todas as regras/preços da [Fase 5](reservations.md).
6. Revisar os dados públicos de categorias e frota ativa: marca/modelo/versão/ano/capacidade/combustível/câmbio/características/descrição/unidade. Publicar o site expõe esses registros ativos, sem placa, chassi, RENAVAM, km ou notas internas. Unidades/categorias/veículos arquivados ou inativos são filtrados.
7. Se desejar fotos, anexar/revisar uma foto de veículo pelo pipeline da Fase 4 e clicar **Publicar imagem no site**. Só fotos READY são elegíveis. Documentos permanecem privados. Evitar placas/pessoas ou outros dados pessoais na própria imagem; reprocessamento remove EXIF, mas não apaga conteúdo visual.

Sem configuração/publicação, o site mostra preparação ou indisponibilidade e não inventa frota, preços, contato ou políticas. Catálogo publicado pode ser consultado com a conexão pública Supabase; solicitação exige também backend, segredo, limitador e Turnstile. Não existe bypass ou captcha fictício em produção.

## Fluxo do cliente

`/catalogo` filtra marca/modelo, categoria e unidade, com 24 itens por página e desempate por ID. `/catalogo/{id}` mostra somente informações publicáveis e conduz à cotação de um veículo específico. `/categorias` explica a atribuição por categoria. Há estados de carregamento, ausência, erro de filtro e indisponibilidade; imagens ausentes usam ícone, sem foto fictícia.

Em `/reservar`, o visitante escolhe unidade/categoria ou chega com um veículo do catálogo, seleciona plano e horários no **fuso IANA indicado no plano**, adicionais e entrega/coleta. O navegador converte os horários locais para instantes com Temporal; horários ambíguos/inexistentes em mudança de offset são recusados. O servidor valida novamente os instantes e calcula com o mesmo motor da Fase 5. Preço/total/política/desconto/customer_id não são aceitos do navegador.

A cotação retorna itens, total, caução separada, validade e quantidade disponível **indicativa** com buffer operacional. Não há endpoint separado de disponibilidade: essa informação acompanha a cotação validada. A consulta não bloqueia a frota.

Após conferir, o visitante informa PF/PJ, nome, CPF/CNPJ, e-mail, telefone e endereço brasileiro, aceita a versão publicada dos textos e conclui um segundo desafio. A transação registra **REQUESTED**, cliente/vínculo, logística congelada, dados declarados, textos exatos aceitos/versão/data, histórico e outbox. A solicitação não confirma nem recebe pagamento; a atribuição/ocupação só ocorre na aprovação manual.

CPF/CNPJ existente **não permite atualizar seu cadastro**. A solicitação referencia o cliente existente e guarda os dados declarados em `public_reservation_submissions`, com leitura apenas para equipe com `reservations.read` e `customers.read`. O detalhe administrativo mostra esse material para conferência. Cliente novo é cadastrado na mesma transação. Dados declarados não provam identidade; conferência de documentos e retirada continuam necessárias. Clientes arquivados exigem regularização pelo atendimento; erros públicos não dizem se um documento pertence ao cadastro.

O resultado mostra referência e token de 256 bits. Guardar ambos antes de fechar a página. `/consultar-reserva` envia o token em **X-Reservation-Token**, sem query string, URL, localStorage ou cookies com o token. Retorna só situação/referência/atualização. Token incorreto/expirado/ausente recebe a mesma ausência; indisponibilidade/limites falham fechados. Seguem as garantias de [reservations.md](reservations.md).

## Antispam e repetição segura

- Cookie de visitante assinado por HMAC, HttpOnly, SameSite=Strict, Secure em HTTPS e validade de 24 horas. É isolamento/quota de visitante, não autenticação ou comprovação de identidade.
- Origin canônica obrigatória nas mutações, JSON limitado pelos bytes reais a 64 KiB, schemas estritos, honeypot e mínimo de dois segundos após iniciar a sessão.
- Turnstile **Siteverify obrigatório no servidor**. Valida success, hostname, action (`quote` ou `reservation`) e challenge_ts; timeout de oito segundos e erro de rede/provedor recusam a operação. Nenhum IP encaminhado é aceito como identidade confiável. O servidor envia apenas segredo/resposta/idempotência à Siteverify, sem CPF, nome ou dados da reserva.
- O token Turnstile expira em cinco minutos e é de uso único. O widget renova em falha/expiração; cotação e solicitação usam ações distintas. A verificação usa chave de idempotência estável por tentativa. Referência primária: [validação oficial](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) e [widget](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/).
- Quotas distribuídas por janela de 15 minutos: 30 inícios de sessão por visitante, 10 cotações por visitante, 5 solicitações por visitante, 3 por hash de CPF/CNPJ e 3 por hash de e-mail; cada escopo também consome o teto global de 1000. Status mantém 30 por token/1000 globais. Fotos têm 300 por ID/1000 globais. Limpeza e dimensionamento dessas quotas precisam ser homologados para o tráfego esperado; rotação de cookie não elimina quotas globais/documento/e-mail. Proteção adicional na borda pode ser configurada sem confiar em headers arbitrários.

Idempotência é por visitante/operação/chave e hash do payload normalizado. O replay próprio lê o resultado antes de consumir novamente o desafio de uso único. Payload diferente com a mesma chave retorna conflito. A persistência serializa chaves concorrentes; cada cotação só pode originar uma reserva. Chaves são mantidas na instância do formulário, não sobrevivem a fechar/recarregar a página. Após resposta incerta, repetir com os mesmos dados na página aberta; clientes REST devem preservar chave e cookie. Nova cotação expirada recebe nova chave. O token final é derivado por HMAC e só seu hash persiste; não fica no registro de idempotência.

## Banco e Storage

Migration 19 acrescenta flags explícitas de publicação, configuração pública sob permissão/versão, projeções allowlist e publicação de fotos pronta. As projeções antigas de catálogo também respeitam a publicação global; revisão de grants impede chamar helpers diretamente. Migration 20 acrescenta operações públicas e dados de submissão sob RLS, replay/ownership, persistência de cotação confiável e solicitação. Extração de um helper transacional comum preserva as regras da solicitação de equipe e evita divergência entre os dois canais.

Persistência pública e consulta de ownership só têm EXECUTE para **service_role**, invocadas pelo backend depois dos controles. A chave nunca chega ao cliente. O banco verifica publicação, plano/adicionais, fingerprint, desconto zero, ownership, validade, versão de aceite e origem única. O algoritmo monetário continua no servidor confiável; o banco confere tipos, totais de itens, caução e imutabilidade. Escritas anônimas diretas nas tabelas continuam negadas.

Publicação de tarifas usa o mesmo lock da Fase 5; configuração do site é lida sob lock compartilhado durante a gravação. Aceites guardam os textos exatos, mesmo após editar a política. Não há alteração de snapshots já aceitos. As duas tabelas novas não expõem tokens em texto nem perfis; a submissão é imutável e sua auditoria guarda somente operação/ID.

Buckets permanecem privados. Foto publicada é servida pelo proxy `/api/v1/public/images/{id}` após verificar site, estado READY, publicação e veículo/categoria/unidade ativos. O backend baixa os bytes do caminho interno e devolve JPEG sem divulgar path/signed URL. Sem cache para novas requisições respeitarem retirada/arquivamento. Uma imagem já baixada por um visitante não pode ser revogada do dispositivo dele. Categoria não tem upload público nem documentos expostos. Validar Storage HTTP, tipo, latência/limites e publicação real em homologação.

## Homologação que depende da configuração

- Supabase/PostgreSQL 17, lint/pgTAP e tipos gerados; migrations 19/20 ainda não aplicadas a projeto remoto. Fazer backup/revisão antes de usar base existente. Flags novas começam privadas; cadastro existente não é publicado automaticamente sem a configuração global.
- JWT/PostgREST, schema cache, catálogo anônimo, RPCs exclusivas de backend, ownership e leitura da submissão por cargo. Bootstrap/Auth/SMTP seguem conforme [authentication.md](authentication.md).
- Widget Turnstile real no hostname correto e Siteverify com action/hostname/validade; teste de bloqueio, expiração, token duplicado, scripts bloqueados, rede indisponível e teclado/leitor de tela. Permitir o domínio challenges.cloudflare.com em rede/CSP conforme documentação oficial, sem registrar tokens. Chaves de teste não podem ir para produção.
- Formulário real desktop/mobile: categoria e veículo, entrega/coleta/endereço, CPF/CNPJ, fuso, vigência, caução, repetição após perda de resposta e troca de políticas durante o aceite.
- Fluxo HTTP completo navegador → Supabase → solicitação → funcionário autenticado aprova/rejeita/cancela → status mínimo. Confirmar histórico/outbox/ocupação e ausência de PII em respostas/logs; conferir a identidade declarada.
- Publicação/retirada de fotos, ausência de acesso a documentos, validade dos controles após arquivar frota/unidade/categoria e sem bypass por RPC antiga.
- Aprovar textos/contatos, política de retenção e descarte seguro das submissões, operações públicas, cotações, limites e logs. Não executar limpeza genérica de snapshots/FKs. Agendar expiração da Fase 5; e-mail/worker da outbox segue na Fase 8, sem promessa de mensagem enviada nesta fase.

Não há Docker/CLI ou credenciais/Turnstile configurados neste ambiente. Testes unitários usam adapters para SDK/cookies/Siteverify; SQL usa PostgreSQL 18.4 real com shim exclusivo de teste para Auth/Storage. Playwright cobre indisponibilidade real e formulário com HTTP/widget interceptados **apenas no teste**, sem modo mock de produção. O percurso SQL público até aprovação real foi executado; o E2E HTTP integrado à stack Supabase/Cloudflare e a revisão assistiva real permanecem pendentes.
