# Fase 5 — tarifas, cotações e reservas

Atualização: a Fase 6 acrescentou catálogo e solicitação públicos, publicação explícita, antispam e intake privado; ver [public-site.md](public-site.md). Os resultados e limites abaixo registram a entrega da Fase 5.

Implementação local de 20/10/2026. As migrations **16–18** acrescentam o fluxo comercial às 54 tabelas existentes. As 01–15 foram preservadas. Nenhuma migration, tarifa ou configuração foi enviada a um projeto Supabase remoto.

## Como usar após configurar o Supabase

1. Entrar com ADMIN ou MANAGER. Cadastrar a unidade, categoria, veículo e cliente pelos módulos da Fase 4.
2. Em **Planos tarifários**, informar todas as regras comerciais, incluindo valores zero quando essa for a decisão da empresa. Plano legado com `policy={}` não gera cotações.
3. Em **Preços e vigências**, informar o plano, exatamente uma categoria ou um veículo, valor e início/fim com offset. O fim é exclusivo. A vigência precisa cobrir a locação inteira.
4. Cadastrar os serviços adicionais reais. Nenhum preço de teste é seed de produção.
5. Em **Reservas → Nova cotação e reserva**, selecionar período/alvo/unidade, cliente, adicionais e logística. A cotação apresenta itens, total, caução separada e validade. A disponibilidade apresentada é indicativa.
6. Solicitar a reserva e guardar o token de consulta entregue na resposta. O pedido inicia como REQUESTED, sem bloquear veículo.
7. Analisar a reserva, registrar motivo e aprovar, rejeitar ou cancelar conforme o cargo. A aprovação atribui veículo e ocupa a agenda atomicamente. Não há confirmação automática ao solicitar.

ATTENDANT pode cotar sem desconto, solicitar, iniciar análise e cancelar pendência. ADMIN/MANAGER podem configurar preços, autorizar desconto dentro dos limites configurados e aprovar/rejeitar/cancelar confirmação. FINANCE consulta planos/preços/adicionais, mas não recebe cotações, clientes, logística ou reservas só por ter `pricing.read`. Permissões atuais e sessão ativa são conferidas no servidor e novamente no banco.

## Regras implementadas

| Configuração          | Comportamento                                                                                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Precedência           | Veículo específico antes de categoria. Uma exceção por veículo que cobre só parte da locação causa conflito; não há fallback silencioso nesse caso.                                                      |
| Vigência              | Uma tarifa deve cobrir todo o intervalo `[retirada,devolução)`. Não há divisão automática entre tabelas sazonais. Arquivar permite cadastrar substituta; restaurar pode conflitar.                       |
| Duração               | `ELAPSED`: dias de 24 horas; `LOCAL_DAYS`: dias civis no fuso IANA do plano. Semanas têm sete desses dias.                                                                                               |
| Mensal                | `CALENDAR`: aniversário ancorado na retirada, ajustado ao último dia do mês, retomando o dia original nos meses seguintes; `COMMERCIAL`: quantidade de dias informada pela empresa.                      |
| Mínimo                | `minimum_periods` cobra pelo menos a quantidade configurada de períodos principais, inclusive em uma locação curta.                                                                                      |
| Excedentes            | `CEIL_PERIOD`: próximo período inteiro; `DAY_HOUR`: dias/horas após os períodos principais; `WEEK_DAY_HOUR`: mês → semanas → dias → horas. Não procura automaticamente a combinação mais barata.         |
| Tolerância            | Dispensa o excedente completo quando estiver dentro da tolerância. Acima dela, cobra todo o excedente, sem subtrair a tolerância.                                                                        |
| Hora                  | Incrementos explícitos de 15/30/60 minutos, com arredondamento para cima da quantidade.                                                                                                                  |
| Dinheiro              | Strings decimais BRL, centavos `bigint`, teto individual e total `9.999.999.999,99`. Cada linha usa HALF_UP, CEIL ou TRUNCATE conforme o plano. Quantidade tem quatro casas.                             |
| Adicionais            | Quantidade selecionada multiplicada pela duração real arredondada para a unidade do serviço. Não herdam a tolerância/minímo da tarifa. Mensal exige modo mensal do plano.                                |
| Logística             | Entrega/coleta opcionais, habilitadas no plano, com taxa fixa. Exigem endereço brasileiro. Não há cálculo de distância. Endereços e taxas são congelados na solicitação.                                 |
| Desconto              | Valor explícito e motivo, permissão `discounts.authorize` e limite por cargo em pontos base (100 = 1%). Base: aluguel ou aluguel + serviços; logística e caução ficam fora. Validação repetida no banco. |
| Caução                | Separada do total da cotação, sem gerar recebimento nem receita. Movimentação financeira segue na Fase 8.                                                                                                |
| Intervalo operacional | `turnaround_minutes` amplia a ocupação até depois da devolução. Nova retirada exatamente ao fim desse intervalo é permitida; sobreposição é recusada. A regra vem do snapshot, não do plano atual.       |

Instantes devem incluir offset ou `Z`. O motor usa `@js-temporal/polyfill` 0.5.1 para regras de calendário/fuso. As telas administrativas exibem horários no fuso de Fortaleza, indicado na interface; o cálculo usa o fuso configurado do plano. Referências primárias: [aritmética Temporal](https://tc39.es/proposal-temporal/docs/zoneddatetime.html) e [polyfill oficial](https://github.com/js-temporal/temporal-polyfill).

## Persistência e concorrência

O navegador envia escolhas, quantidades e eventual desconto, sem total/política. Zod recusa campos extras. `staff_pricing_context` seleciona a tarifa sob lock, devolve a política versionada e um fingerprint de todos os valores selecionados. O servidor calcula o preço. `persist_staff_quote` é exclusivo de service_role, revalida ator/sessão/permissões, fingerprint, caução e desconto, insere itens e bloqueia o snapshot na mesma transação. O banco não executa o algoritmo Temporal: essa RPC é uma fronteira de confiança do backend. Nunca conceder EXECUTE dela a authenticated/anon nem expor service role.

O lock comum com escritas de planos/preços/adicionais impede incluir ou alterar uma tarifa entre a verificação e a gravação. Mudança após o cálculo devolve conflito; a tentativa pode ser repetida. Regras de plano ganham versão e histórico append-only em `pricing_rules`. Alterações de preços/adicionais mudam o fingerprint; cotações antigas continuam imutáveis.

Solicitação e decisões usam chaves de idempotência por ator/operação e hash do payload. Repetir a mesma chave retorna o mesmo resultado; mudar o payload com a mesma chave causa 409. O replay de cotação busca o registro anterior antes de exigir que a tarifa atual ainda exista. Após a validade, a interface gera nova chave ao recalcular. As chaves ficam na instância aberta do formulário; um cliente REST deve preservá-las ao repetir uma requisição cujo resultado é incerto. A retenção/limpeza de `idempotency_keys` precisa ser definida antes da operação; o campo expires_at sozinho não remove registros.

Uma cotação sem cliente é copiada e vinculada ao cliente na solicitação, sem editar a original. `source_quote_id UNIQUE` impede solicitar duas reservas a partir da mesma cotação, inclusive com chaves distintas. A solicitação congela logística e grava histórico/outbox na mesma transação. O prazo de análise termina no menor instante entre início da locação e `request_validity_minutes`. A cotação precisa estar válida ao solicitar; depois a aprovação respeita esse prazo e o snapshot aceito, sem exigir tarifa atual ou validade original da cotação.

Decisões exigem versão esperada e motivo. A confirmação bloqueia reserva, categoria e veículo, valida atividade e unidade, atribui veículo e insere ocupação/histórico/outbox. A exclusion constraint GiST comum a reservas, locações, bloqueios e manutenção é a defesa final. Locações ACTIVE/OVERDUE ainda sem devolução e com fim passado impedem nova atribuição. Cancelamento libera a ocupação na mesma transação. A migration 18 preserva o mesmo intervalo configurado na infraestrutura de prorrogação; o fluxo completo de locação segue na Fase 7.

## Token e expiração

O token de consulta tem 256 bits, derivado por HMAC de `AUTH_SECRET`, ator, cotação e chave de idempotência. Isso permite devolver o mesmo token em uma repetição. Só SHA-256 é salvo em `lookup_token_hash`; `safe_response`, histórico, outbox e URLs não guardam o token. Rotacionar AUTH_SECRET impede reconstruir tokens antigos por replay; os já entregues continuam verificáveis pelo hash até sua validade. Não registrar cabeçalhos de autorização/token no proxy, APM ou logs.

`GET /api/v1/public/reservations/{id}/status` recebe **X-Reservation-Token**, nunca query string. Retorna apenas id/status/updated_at. Token incorreto, expirado, ausente ou referência inválida recebe 404 uniforme; falta de infraestrutura, 503. O limitador distribuído consome quota global e por hash antes da consulta: 1000 requisições globais e 30 por token em 15 minutos, com falha fechada. Não depende de IP encaminhado. A política de produção pode precisar de quotas adicionais na borda.

`expire_pending_reservations(batch_size)` é exclusiva de service_role; processa 1–1000 pedidos vencidos com SKIP LOCKED, histórico e outbox, sem expirar confirmações. A equipe com `reservations.approve` pode disparar lotes de 100 pelo painel/API com Origin validado. O histórico dessa execução registra expiração de sistema, sem ator humano. Pedidos vencidos já não podem ser aprovados ou revisados, mesmo antes de executar o job.

**Agendamento não configurado:** escolher no ambiente Supabase/infra um job que chame essa RPC periodicamente com credencial de servidor; monitorar execução, backlog e falhas. A outbox está pronta, mas envio de e-mails/retries/worker segue na Fase 8. Não foram criados cron remoto, webhook, serviço pago ou automação nesta entrega.

## Configuração e homologação pendentes

Aplicar migrations 16–18 em homologação após as 01–15, com backup/revisão do legado. Elas acrescentam colunas, mudam as exclusões de tarifa para ignorar arquivadas e substituem funções de ocupação/aprovação/prorrogação. `source_quote_id` é preenchido com o quote_id existente; a atualização percorre triggers e incrementa versões das reservas preexistentes. Validar esse impacto antes da aplicação em base com dados reais. Não usar reset remoto. Depois executar lint/pgTAP/PostgreSQL 17 e gerar tipos oficiais conforme [setup](database/setup.md).

Permanecem necessárias URL/chave publicável/service role, AUTH_SECRET forte, canonical URL/HTTPS, contas ativas e Auth/SMTP/Storage da [Fase 3](authentication.md). A Fase 5 não cria buckets novos. Docker e CLI não estão disponíveis neste ambiente e não há credenciais configuradas; não foram exercitados JWT criptográfico, PostgREST ou interface autenticada real.

Antes de liberar o fluxo:

- Definir valores comerciais, mês, período mínimo, tolerância, excedentes, arredondamento, adicionais, caução, descontos, logística, intervalo e prazos. Não copiar fixtures de teste.
- Homologar ADMIN/MANAGER/ATTENDANT/FINANCE, revogação/sessão expirada, CRUD tarifário e visibilidade restrita de quotes/quote_items.
- Verificar HTTP de `staff_pricing_context`, relações embutidas de quotes/reservations e RPCs em PostgREST com JWT real. Confirmar a atualização do schema cache após migrations.
- A relação reserva/item é 1:1 por FK UNIQUE: PostgREST retorna objeto, que o serviço normaliza para lista de um item. Esse formato tem teste de adapter; a chamada HTTP real ainda depende de homologação. Referência: [detecção de relações PostgREST no Supabase](https://supabase.com/blog/postgrest-v10).
- Executar fluxo autenticado: cotar → solicitar → repetir → analisar → aprovar/rejeitar/cancelar → expirar; disputar veículo/categoria e bloqueio/manutenção; confirmar ausência de órfãos e mensagens duplicadas.
- Verificar telas desktop/mobile/teclado/leitor de tela, datas com offset, erro de desconto/vigência, renovação da cotação expirada e comportamento após perda de resposta. A revisão visual/assistiva autenticada está pendente.
- Homologar token/header, validade, 404 uniforme, quotas e ausência de token/PII em logs; configurar limpeza/retencão e job de expiração.

## Evidência local

`npm test` cobre o motor (fim de mês, ano bissexto, DST, tolerância, pacotes, dinheiro, adicionais, descontos, overflow), schemas, RBAC do serviço, cálculo no servidor, idempotência, token e limite/falha fechada. `npm run test:db` reaplica 18 migrations e testa os fluxos com PostgreSQL 18.4 isolado, incluindo 9 cenários comerciais novos e todos os anteriores. Não equivale à stack Supabase/PostgreSQL 17.

Playwright verifica que tarifas/reservas e APIs ficam fechadas sem configuração, inclusive com cargo/cookie/total forjado, e que status público não é cacheado. Não é evidência de CRUD autenticado no navegador. O pgTAP `004_commercial.test.sql` está preparado para a stack completa, ainda não executado. Resultados consolidados em [verification.md](verification.md); contrato em [commercial.openapi.yaml](api/commercial.openapi.yaml).

A solicitação pública completa, catálogo e antispam com desafio são da Fase 6. Conversão, locação, contratos e vistorias estão na [Fase 7](rentals.md); a interface financeira completa segue na Fase 8.
