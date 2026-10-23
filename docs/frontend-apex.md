# Frontend Apex

A direção escolhida foi **Apex Direção**: branco, grafite e vermelho profundo, com acabamento metálico restrito à marca. A interface usa Manrope hospedada localmente e ícones Lucide. O contrato de direção está em `.impeccable/surfaces/src-app.md`; o sistema visual final fica em `DESIGN.md` e `.impeccable/design.json`.

## Escopo entregue

- Identidade compartilhada, navegação pública responsiva, página inicial em preparação e sua variante publicada com catálogo real.
- Acesso da equipe com a mesma identidade, formulários existentes e controle de visibilidade da senha.
- Estrutura administrativa com navegação por permissões, menu móvel, identificação da sessão e logout existente.
- Visão geral com período, próximos passos, frota, devoluções, ocupação e financeiro, preservando os dados e as regras dos serviços existentes.
- Empacotamento do diretório `public` para execução standalone e Docker.
- Frota, clientes e condutores: busca e filtros, tabelas responsivas, criação e edição em grupos de campos, consulta sem edição, arquivamento, arquivos autorizados e histórico existentes.
- Reservas: lista por situação, cotação com datas locais de Fortaleza, logística condicional, detalhe com período, caução separada, decisão e conversão conforme a permissão.
- Locações: lista por situação, locação direta, preparação, retirada/devolução, logística, vistorias/evidências, avarias, prorrogação, contratos/aditivos em PDF e configuração de regras/modelos na mesma identidade.
- Financeiro: consultas separadas de contas a receber, recebimentos, cauções, reembolsos, despesas e ajustes; referências secundárias; ações e novos lançamentos expansíveis por permissão; configuração de meios e limites.
- Manutenção: lista por situação, alertas por data/km/prazo, agendamento, consulta, reagendamento, início, extensão, conclusão com despesa opcional e histórico.
- Relatórios: dez tipos existentes, período inclusivo, definição factual, valores assinados, cobertura histórica, referências completas por linha e CSV da página selecionada.

Financeiro, manutenção e relatórios têm o mesmo peso visual, conforme confirmado. Obrigações, recebimentos, cauções, compensações e pagamentos de despesas continuam distintos; as confirmações explícitas não são preenchidas automaticamente. Formulários financeiros e de manutenção usam data/hora local no `APP_TIMEZONE` recebido do servidor e convertem para instante antes das ações existentes. Reagendamento mostra o valor local correspondente ao instante salvo. Horários inexistentes ou ambíguos por mudança de horário de verão são recusados. O contrato fica em `.impeccable/surfaces/src-components-finance.md`.

O detalhe da locação dá o mesmo destaque às seções de operação, logística, vistorias e contratos, com acesso por âncoras e ações expansíveis. Cliente e veículo específico são obrigatórios na locação direta; novas locações e prorrogações usam datas locais de Fortaleza. As ações transacionais, a concorrência por versão e a idempotência continuam nos serviços existentes. A situação do PDF, as exigências de pagamento e a execução da logística permanecem informações distintas. O contrato desta extensão está em `.impeccable/surfaces/src-components-rentals.md`.

Os documentos permanecem mascarados nas listas. Nos detalhes autorizados, os campos continuam disponíveis às permissões existentes. A situação operacional de um veículo não é apresentada como garantia de disponibilidade para um período. O contrato desta extensão fica em `.impeccable/surfaces/src-components-registry.md`.

O componente de apresentação recebe os dados do servidor. `requirePageStaff()` e as permissões de cada rota continuam responsáveis pela autorização. Ocultar um item de menu é apenas apresentação, nunca autorização. A lista de próximas devoluções da RPC contém até dez registros; sua quantidade é descrita como devoluções **listadas**, não como total de devoluções do negócio.

## Revisar localmente

```powershell
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Abra `http://127.0.0.1:3000/` para o site e `/login` para o acesso da equipe. O estado de publicação continua vindo da configuração real; sem publicação, a página informa preparação e não promete disponibilidade, preços ou atendimento.

Em outro terminal:

```powershell
npm run preview:frontend
```

Abra `http://127.0.0.1:3230/` para a prévia do painel. As telas de `/admin/frota`, `/admin/clientes`, `/admin/condutores`, `/admin/reservas`, `/admin/locacoes`, `/admin/financeiro`, `/admin/manutencao` e `/admin/relatorios` permitem navegar com dados sintéticos identificados no topo. Acrescente `?empty=1` para listas vazias ou `?readonly=1` para consulta sem edição nos fluxos que oferecem essa variante. O parâmetro `?archived=1` permite revisar os estados de arquivamento suportados pelos cadastros. Em locações, os quatro exemplos representam preparação, andamento, atraso e encerramento; `/nova` e `/configuracao` mostram os formulários correspondentes. Manutenção oferece três serviços ilustrativos: agendado, em execução e concluído. Nos relatórios, `?operations=1` demonstra um perfil com acesso apenas aos tipos operacionais; isso não configura uma sessão real.

Esse servidor escuta apenas em loopback, usa os componentes reais e hidrata os controles React. Filtros, expansão, validação e campos condicionais podem ser experimentados. As ações são substituídas por funções locais que recusam a gravação com uma mensagem explícita; a prévia não lê credenciais, não cria sessão nem acessa o banco. Isso inclui processar PDFs, obter links de arquivo, anexar fotos e registrar movimentos financeiros: nenhum arquivo é enviado ou gerado e nenhum valor é movimentado. O CSV está desabilitado e explicado na prévia; o endereço real de exportação permanece somente na aplicação protegida. Os filtros da prévia selecionam fixtures, sem reproduzir todos os filtros/paginação do banco. A navegação das áreas demonstradas permanece na prévia; destinos fora desse escopo encaminham para a aplicação protegida na porta 3000. Reinicie esse processo após alterar componentes. Ele não integra o deploy da aplicação. Para usar outra porta no PowerShell, defina `$env:PREVIEW_PORT = '3232'` antes de executar o comando.

## Verificações

```powershell
npm run lint
npm run typecheck
npm run test
npm run check:security
npm run build
npm run test:e2e
npm run test:ui
npm run test:standalone
```

A suíte E2E padrão verifica uma implantação sem segredos de workers/readiness. `playwright.config.ts` limpa esses três valores somente no processo de teste para que `.env.local` não altere as expectativas. As verificações de recusa de acesso continuam estritas. Isso não modifica o arquivo de ambiente ou as configurações reais.

Os testes de apresentação verificam destinos por permissão, criação de reservas, valores financeiros exatos, separação de cauções, ausência de indicadores restritos e estados vazios. As capturas de revisão ficam em `.impeccable/review/`. Capturas do painel usam dados ilustrativos; não comprovam uma sessão Supabase autenticada.

Validação da identidade inicial em 20/10/2026: build de produção, TypeScript, lint, segurança estática e smoke standalone aprovados; 154 testes unitários e 46 testes E2E aprovados. O smoke verificou a entrega do material de marca e o worker de PDF.

Na extensão de cadastros e reservas, build de produção (incluindo TypeScript), lint e segurança estática passaram; 158 testes unitários, 46 testes E2E de produção e 14 testes da prévia passaram. A suíte `test:ui` usa um servidor de prévia isolado na porta 3231, em desktop e celular, para verificar as quatro listas, campos brasileiros e mascaramento, cobertura dos grupos de campos, foco de erro, logística condicional, valores e consulta sem ações. Inclui verificações Axe e de largura da página. Os resultados e capturas desta extensão ficam em `.impeccable/review/records/` e `.impeccable/test-results/records-ui/`.

Não foram repetidos os testes de banco ou o smoke standalone nesta extensão, pois SQL, serviços de dados, empacotamento e arquivos de marca não mudaram. A suíte da prévia não valida gravação, Storage remoto nem uma jornada Supabase autenticada. Essas verificações dependem da configuração de implantação e de uma sessão real com as permissões correspondentes.

Na extensão de locações, em 21/10/2026, passaram build de produção/TypeScript, lint, segurança estática, 163 testes unitários, 46 E2E de produção e 26 testes da prévia (14 anteriores e 12 novos). A cobertura adicionada verifica permissões e estados da apresentação, escala monetária exata das taxas, filtros, retirada/devolução, respostas de vistoria, arquivos e reagendamento, prorrogação com data local e configuração sem aprovação jurídica presumida. Testes de interface incluem Axe e overflow em desktop e celular. Capturas e relatórios: `.impeccable/review/rentals/`. Nenhum SQL, serviço, política ou worker foi alterado, portanto os testes de banco e o smoke standalone não foram repetidos.

Na extensão de financeiro, manutenção e relatórios, em 21/10/2026, passaram build de produção/TypeScript, lint, segurança estática (188 módulos/30 rotas), 171 testes unitários, 46 E2E de produção e 42 testes da prévia (26 anteriores e 16 novos). Depois do refinamento visual de referências e formulário, o build, os oito unitários relevantes e os 16 testes de interface das três áreas passaram novamente. O último `.last-run.json` da prévia corresponde a esse recorte. A cobertura inclui valores assinados, distinção de caução/receita, permissões de consulta, confirmação explícita, fuso/DST, serviço encerrado, tipos de relatório, período inválido, página CSV e limites sem configuração presumida. Capturas e relatórios ficam em `.impeccable/review/business/`. Nenhum serviço, SQL, ledger, worker ou regra de exportação mudou; testes de banco e smoke standalone não foram repetidos nesta extensão.

A revisão independente do Impeccable pediu títulos factuais e barras de rolagem integradas ao grafite. Depois desse lote, o build e os dez testes E2E de páginas, proteção e acessibilidade foram repetidos e passaram. A verdict pass marcou as duas correções como resolvidas, com disposição `ship` nesse escopo. Evidências: `.impeccable/review/finish-review.md` e `.impeccable/review/finish-verdict.md`.

Para a extensão de frota, clientes, condutores e reservas, a revisão independente retornou `ship` no escopo visual examinado, sem correções materiais. A documentação confirmou a aderência ao sistema existente na amostra e preservou DESIGN.md e seu sidecar. Relatórios: `.impeccable/review/records/finish-review.md` e `.impeccable/review/records/system-adherence.md`. O drift temporal preexistente entre DESIGN.md e o sidecar foi registrado sem alteração das normas.

A revisão independente das locações retornou `ship` para a apresentação e os estados examinados nas 22 capturas. Uma referência documental ao seed herdado foi corrigida e verificada nos dois contratos durante a revisão. Não houve reparo visual material pendente. A documentação de aderência confirmou a continuidade Apex na amostra e preservou DESIGN.md e o sidecar. Relatórios: `.impeccable/review/rentals/finish-review.md` e `.impeccable/review/rentals/system-adherence.md`. Isso não constitui aprovação de integrações remotas ou de conteúdo jurídico dos contratos.

Para financeiro, manutenção e relatórios, a revisão independente retornou `ship` no escopo de apresentação e estados das 27 capturas, sem ajustes materiais. A documentação de aderência confirmou a continuidade Apex na amostra e preservou DESIGN.md e o sidecar. Evidências e limites estão em `.impeccable/review/business/finish-review.md`, `system-adherence.md` e `capture-notes.md` da mesma pasta. Essa disposição visual não comprova movimentações financeiras, autenticação ou integrações remotas.

## Dependências de implantação

### Site público e Magic UI — 23/10/2026

A apresentação pública foi refinada com prioridade em **consultar a frota e solicitar reserva**, preservando a direção Apex, o painel e as regras comerciais. A home recebe busca GET por marca/modelo, ações principais mais claras, seção do processo de locação e rodapé com navegação agrupada. Catálogo, categorias, cotação, consulta por token, contato e políticas compartilham o mesmo tratamento de títulos e espaçamento. Os cartões mostram características reais, ausência de foto e acesso à cotação; não apresentam valores ou disponibilidade presumidos.

Foram incorporados localmente dois componentes do [Magic UI](https://magicui.design/docs/installation): [Interactive Hover Button](https://magicui.design/docs/components/interactive-hover-button) e [Shine Border](https://magicui.design/docs/components/shine-border), adaptados à identidade Apex em `src/components/magicui`. A licença MIT original acompanha os componentes. A integração segue o modelo de código-fonte da biblioteca, sem adicionar dependências npm. Os efeitos usam CSS, respeitam redução de movimento e mantêm conteúdo visível desde o primeiro render. Links, botões e formulários preservam sua semântica e foco de teclado.

Para revisar com dados ilustrativos, abra `http://127.0.0.1:3230/publico` após iniciar `npm run preview:frontend`. `?empty=1` mostra catálogo vazio e `?preparacao=1` mostra preparação. A faixa de demonstração identifica esse ambiente; veículos não são ofertas reais e não há gravação, sessão ou comunicação com o banco. Os destinos do catálogo e reserva continuam apontando para a aplicação local real. No site real, a busca da home encaminha `q` para `/catalogo` e preserva os filtros existentes.

Passaram build de produção/TypeScript, lint, segurança estática, **80 testes de interface** (76 anteriores e quatro novos) e **dois E2E de reservas com adaptadores HTTP**. A cobertura nova inclui estados publicado/vazio/preparação, Axe, overflow, menu móvel, foco e redução de movimento. A busca GET também foi exercitada no navegador. Banco, testes unitários e suíte E2E integral não foram repetidos nesta alteração de apresentação. A matriz visual contém 23 capturas de viewport em `.impeccable/review/public-magicui`, com dimensões e limites registrados em `capture-manifest.json` e `capture-notes.md`.

Na observação local desta revisão, o site estava publicado, mas sem veículos/categorias disponíveis, e as solicitações online estavam indisponíveis por configuração. As políticas exibiam textos provisórios. Antes do lançamento: cadastrar e publicar frota, fotos autorizadas, planos/preços e serviços reais; revisar contatos, condições e privacidade; configurar o antispam conforme `docs/public-site.md` e seguir `docs/deployment.md`. Nenhum dado, Auth, chave, política RLS ou publicação remota foi alterado nesta etapa. O estado atual de Auth e do primeiro administrador está documentado em `docs/supabase-project.md`; as referências abaixo a adiamento descrevem as etapas visuais anteriores.

### Extensão administrativa e cadastros comerciais — 21/10/2026

Notificações, acessos da equipe e publicação do site receberam a identidade Apex. Avisos apresentam leitura explícita e contagem da página; acessos mostram cargo/situação antes da edição; configurações separam regras, versões imutáveis e filas. Falhas de leitura/processamento são recuperáveis e não simulam sucesso. A proteção do último administrador e as ações de servidor foram preservadas.

Categorias, unidades, planos, preços e adicionais usam listas específicas, formulários agrupados, consulta e arquivamento existentes. Planos distinguem identificação, contagem, excedentes, caução/logística, descontos/prazos e publicação. Preços usam data/hora local no fuso informado, convertem antes da validação/ação existente e preservam o instante original quando não editado. O fim permanece exclusivo, com categoria ou veículo exclusivamente; motor e schema comercial não mudaram.

Prévia: `/admin/notificacoes`, `/admin/notificacoes/configuracao`, `/admin/usuarios`, `/admin/site`, `/admin/categorias`, `/admin/unidades`, `/admin/planos`, `/admin/precos`, `/admin/adicionais` no servidor separado `http://127.0.0.1:3230`. Cadastros oferecem `/novo`, detalhes e estados `?empty=1`, `?readonly=1`, `?archived=1` nos fluxos aplicáveis. `?nolookups=1` demonstra ausência de vínculos nos novos cadastros comerciais. As ações locais recusam gravação, publicação, processamento e mudança de acesso; as rotas reais continuam protegidas.

Passaram build/TypeScript, lint, segurança estática, 175 testes unitários, 46 E2E e 76 de interface (desktop/celular, Axe e overflow). O primeiro teste de PDF sob carga excedeu seu limite; a suíte repetida passou sem ajuste do limite. Testes de banco não foram repetidos porque não houve mudança SQL. Após autorização explícita do usuário, a prévia abriu normalmente e a inspeção visual foi retomada, cobrindo desktop 1440×900, celular 390×844 e viewport real atual 1280×720. O revisor pediu dois ajustes de linguagem: motivos/retentativa em português com diagnóstico recolhido e abertura “Editar regra” distinta de envio “Salvar regra”. Depois deles, build/TypeScript, lint e os 76 testes de interface/Axe passaram novamente. A rodada de 13 capturas corrigidas foi aberta e conferida. A matriz atual tem 66 caminhos em `.impeccable/review/commercial/capture-manifest.json` mais quatro capturas administrativas mantidas, total de 70 arquivos. URLs, dimensões e rolagem estão no manifesto; limites em `.impeccable/review/administration/capture-notes.md`. `fix-capture-manifest.json` registra a rodada específica de correções.

O primeiro finish review retornou `recapture` pela ausência de evidências finais. Após autorização, a revisão integral de 66 capturas validou identidade/composição/responsividade e pediu duas correções de linguagem em `.impeccable/review/commercial/finish-review.md`. A rodada seguinte marcou ambas como `resolved`, sem regressão material nas 13 recapturas, com disposição `ship` no escopo dessas correções em `finish-verdict.md`. Esse verdict não é apresentado como uma segunda revisão integral. A aderência amostrada ao sistema está em `.impeccable/review/commercial/system-adherence.md`; DESIGN.md e sidecar permanecem preservados. A aprovação visual não comprova integrações remotas.

Na homologação com Supabase, conferir avisos exclusivamente do destinatário, marcação de leitura, versões/regras e reprocessamento idempotente. Para e-mail, configurar no servidor `NOTIFICATION_EMAIL_PROVIDER`, `RESEND_API_KEY`, `NOTIFICATION_FROM`, remetente verificado e worker autenticado com `OPERATIONS_JOBS_SECRET`, conforme `docs/business-operations.md`. Aceite do provedor não comprova entrega. Para equipe, criar contas/perfis no Supabase Auth, testar cada cargo, revogação e proteção do último administrador ativo. Credenciais de servidor nunca entram nos campos públicos. A configuração remota e o primeiro administrador permanecem adiados.

Para os cadastros comerciais, validar vínculos ativos, sobreposições de vigência, preços por categoria/veículo, revisão concorrente, arquivamento/restauração e permissões de cada cargo. Configurar planos/valores aprovados e manter `APP_TIMEZONE` consistente com `company_settings.timezone`. Publicação de plano/adicional e liberação do site são decisões separadas; nenhum dado ilustrativo deve ser publicado. DESIGN.md e sidecar foram preservados, inclusive o aviso temporal preexistente.

A configuração do Supabase Auth, a chave exclusiva de servidor e o primeiro administrador foram adiados a pedido do usuário. O login permanece indisponível enquanto a configuração exigida não estiver pronta. A revisão visual não requer essas etapas e não as substitui. Retomar o roteiro de implantação antes de validar jornadas administrativas com usuários e dados reais. Não foi feita alteração remota de Auth ou banco neste trabalho.

Para locações, validar com sessão real e perfis correspondentes: criação/conversão, conflito de versão e disponibilidade, vinculação de CNHs/documentos, upload e assinatura temporária de evidências, pré-requisitos de retirada, apuração de devolução e quitação, prorrogação e geração/reprocessamento de PDFs. Também dependem da implantação os buckets privados/políticas, configuração do worker e dados/modelos operacionais aprovados descritos em `docs/rentals.md` e `docs/deployment.md`. O frontend preserva essas exigências; a prévia não as substitui.

Para financeiro, manutenção e relatórios, seguir `docs/business-operations.md`: configurar meios aceitos e limites aprovados; manter `APP_TIMEZONE` consistente com `company_settings.timezone`; homologar por cargo as confirmações, saldos, compensações, reembolsos e conflitos de manutenção; conferir a conclusão atômica com despesa e a liberação de disponibilidade; validar relatórios contra o ledger e CSV real (página, autorização, limite de exportações e auditoria). Esses fluxos dependem de Auth, migrations/RLS e configuração do projeto real. A prévia não testa conciliação, liquidação bancária, movimentação real ou exportação remota. Nada foi alterado no Supabase durante este trabalho visual.

Para publicar o catálogo e as reservas, ainda são necessários os dados comerciais reais, frota/categorias e fotos autorizadas, regras de atendimento e publicação do site, além da configuração de antispam e dos serviços já descritos no roteiro de implantação. Não usar o material decorativo da marca como foto de veículo disponível.

O raster `public/brand/apex-metallic.png` é decorativo e tem prompt de geração incorporado e sidecar de procedência. A licença da fonte está em `assets/fonts/Manrope-OFL.txt`. O Dockerfile foi atualizado para copiar os arquivos públicos; a imagem Docker requer validação em ambiente com Docker disponível.
