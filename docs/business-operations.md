# Fase 8 — financeiro, manutenção, indicadores e notificações

Implementação local concluída em 20/10/2026, preparada para homologação. Não houve aplicação remota de migrations, contratação de serviços, envio real de email ou publicação. Evidências em [verification.md](verification.md). As pendências de integração abaixo continuam necessárias antes do uso comercial.

## Telas e acesso

| Tela                                               | Permissão e uso                                                                                                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/financeiro`                                | `finance.read`; contas, recebimentos, cauções, reembolsos, despesas e ajustes. Filtros e páginas de 20 registros. Busca por nome/identificador para localizar opções além dos primeiros 100. |
| `/admin/financeiro/configuracao`                   | ADMIN (`settings.manage`); meios de pagamento ativos e limites de desconto por cargo.                                                                                                        |
| `/admin/manutencao`                                | `maintenance.read`; agenda, histórico, alertas por data/km e serviços vencidos ainda abertos.                                                                                                |
| `/admin/manutencao/nova` e `/admin/manutencao/:id` | `maintenance.write`; agendar, iniciar, reagendar, estender, concluir ou cancelar com revisão otimista. Veículos localizáveis pela placa, inclusive inativos/em manutenção.                   |
| `/admin/dashboard`                                 | Indicadores operacionais por `operations.read` e financeiros por `finance.read`; cada domínio é autorizado no banco.                                                                         |
| `/admin/relatorios`                                | `reports.operations` ou `reports.finance` por tipo de relatório; exportação tem a mesma autorização.                                                                                         |
| `/admin/notificacoes`                              | Caixa própria conforme permissões atuais e sessão válida. Marcação de leitura só pelo destinatário.                                                                                          |
| `/admin/notificacoes/configuracao`                 | ADMIN; templates versionados, rotas, processamento manual e revisão de filas.                                                                                                                |

MANAGER tem operações e financeiro; FINANCE recebe somente projeções mínimas de nomes/identificadores, sem CPF, placa, documentos ou notas operacionais. ATTENDANT consulta manutenção e sua caixa operacional, mas não registra recebimentos, despesas nem relatórios. O backend e as RPCs revalidam a permissão; esconder botões não concede autorização.

## Regras financeiras

- Cobranças são obrigações. Criar uma cobrança nunca confirma pagamento. Datas de competência e vencimento são separadas; cobranças legadas sem competência usam o vencimento como referência explícita.
- Recebimentos exigem meio ativo, valor positivo e confirmação de que o dinheiro foi recebido. Podem liquidar parcialmente uma ou várias cobranças do mesmo cliente. O restante fica como crédito livre, alocável depois. Não há gateway ou armazenamento de dados de cartão.
- O saldo da cobrança considera alocações, ajustes, reembolsos alocados, aplicações de caução e seus estornos. Reembolsar uma alocação reabre a dívida; não recria crédito livre no pagamento original.
- Caução RECEIVED não é receita. Pode ser aplicada em cobranças da mesma locação ou devolvida, respeitando seu saldo. Estornar uma aplicação gera registro compensatório, devolve saldo à caução e reabre a cobrança. O motivo da aplicação é preservado.
- Reembolsos exigem origem única (pagamento ou caução), motivo e confirmação de desembolso. A aplicação não movimenta dinheiro em bancos, Pix ou adquirentes; registra a operação realmente executada pelo funcionário.
- Descontos exigem `discounts.authorize` e política configurada pelo ADMIN. Os limites ADMIN/MANAGER são pontos-base (100 = 1%) sobre o valor original, com controle acumulado por cobrança. Sem política não há desconto autorizado. Outros créditos exigem `refunds.create` além de `charges.create`.
- Despesas exigem pagamento confirmado, meio ativo, data não futura e descrição. Podem ter veículo e manutenção correspondentes. Estorno é compensação positiva limitada ao saldo original, com motivo e confirmação; o registro original permanece.
- Todos os ledgers são imutáveis e auditados. Ajustes, restituições e compensações preservam histórico. `finance_command` usa idempotência e o mesmo lock de saldo das RPCs anteriores. Falhas desfazem toda a operação, inclusive alocações e outbox.
- Cancelar uma locação em preparação após movimentação financeira exige antes restituir pagamentos alocados, estornar aplicações e devolver a caução. A transação não presume restituição. As obrigações são compensadas e a ocupação liberada, mantendo o histórico.

Exemplo: cobrança de R$ 100,00, recebimento de R$ 50,00 e alocação de R$ 30,00 deixam R$ 70,00 a receber e R$ 20,00 de crédito. Reembolsar R$ 10,00 da alocação eleva a dívida para R$ 80,00; o crédito livre continua R$ 20,00.

## Manutenção e disponibilidade

Tipos: preventiva, corretiva, óleo, pneus e revisão. Estados: SCHEDULED → IN_PROGRESS → COMPLETED; cancelamento preserva eventos. `expected_version` evita sobrescrever alterações concorrentes. Registro concluído/cancelado não volta a abrir.

Agendamento com bloqueio cria uma alocação MAINTENANCE na exclusão GiST compartilhada por reservas, locações e bloqueios. Conflito recusa a operação inteira; não cancela reserva de cliente nem remaneja automaticamente outro compromisso. Reagendamento e extensão também são atômicos. Início exige janela agendada e veículo fisicamente disponível.

Manutenção bloqueante em andamento ou com término previsto vencido impede nova alocação comercial/retirada até sua conclusão ou tratamento. O intervalo finito não é estendido silenciosamente sobre uma reserva já existente. A agenda e os alertas indicam o serviço pendente para resolução operacional.

A conclusão registra horário efetivo, libera alocação e mantém quilometragem crescente. Próxima data e próximo km são opcionais e explícitos. A despesa opcional usa a mesma transação: se a confirmação financeira falhar, a manutenção continua em execução e nenhum km é alterado. São exigidas também as permissões financeiras do funcionário.

Os alertas consideram o serviço mais recente concluído de cada tipo por veículo não arquivado/aposentado. Disparam quando a data chegou **ou** o km atual atingiu o limite; não há antecedência arbitrária. A data civil é calculada pelo fuso em `company_settings.timezone`, com padrão America/Fortaleza enquanto não houver configuração da empresa. A fila deduplica por serviço. Uma nova manutenção concluída passa a definir a próxima referência.

## Indicadores e relatórios

Períodos usam datas civis inclusivas no `APP_TIMEZONE`, convertidas para intervalo `[início, dia seguinte ao fim)` no servidor. Limite de 366 dias civis; mudança de horário de verão é tratada. Datas de tela usam português brasileiro e o fuso configurado. Valores são calculados em `numeric` no banco e centavos BigInt no servidor; o CSV preserva decimais como texto.

| Relatório     | Definição                                                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| REVENUE       | Obrigações por competência, com ajustes/cancelamentos conhecidos até o fim do período. Não comprova recebimento.                                      |
| RECEIPTS      | Recebimentos confirmados menos reembolsos de pagamentos, nas datas dos respectivos registros. Cauções ficam separadas.                                |
| EXPENSES      | Despesas por data informada do pagamento e compensações por data de registro, com vínculo ao veículo quando existente.                                |
| PROFITABILITY | Contratado por veículo menos despesas líquidas vinculadas. Sem depreciação, impostos e rateio geral; não equivale a lucro contábil ou saldo bancário. |
| BALANCES      | Saldo atual das cobranças com vencimento no período, não saldo histórico na data final.                                                               |
| RESERVATIONS  | Contagem pela situação atual, com início previsto no período.                                                                                         |
| OCCUPANCY     | Horas efetivas de locação divididas por horas de frota ativa observadas, limitadas ao momento atual.                                                  |
| RECURRING     | Clientes com mais de uma locação não cancelada com início previsto no período.                                                                        |
| OVERDUE       | Locações atualmente abertas e vencidas, filtradas pela devolução prevista.                                                                            |
| MAINTENANCE   | Conclusões efetivas no período; legado sem horário efetivo usa o fim previsto.                                                                        |

O histórico de estado da frota começa na implantação. Para veículos preexistentes, marca-se uma base observada, sem supor disponibilidade retroativa. `coverage_limited` informa a limitação nos períodos afetados. O dashboard identifica contadores atuais e movimentações do período separadamente; cauções recebidas/devolvidas/disponíveis não são somadas à receita recebida.

CSV exporta **a página selecionada**, até 100 linhas, com BOM UTF-8, separador ponto e vírgula, aspas e neutralização de fórmulas/controles. Limite distribuído: 10 exportações por funcionário por janela de 15 minutos. A auditoria registra tipo/período/página/quantidade; não copia o conteúdo pessoal. Conciliação bancária, recebíveis de adquirente e relatórios PDF ficam fora desta entrega.

## Notificações e processamento

A transação de negócio grava um evento em outbox. O dispatch SQL usa `FOR UPDATE SKIP LOCKED`, resolve rotas habilitadas e cria notificações uma vez por evento/canal/destinatário. Rotas de painel operacionais/financeiras estão habilitadas; emails dependem de configuração e habilitação explícita. Um evento sem rota é concluído sem mensagem. Ativar uma rota depois não reenvia eventos já concluídos.

Templates são versões imutáveis de texto simples. Somente `{reference}`, `{status}`, `{date}` e `{event}` são aceitos. Conteúdo e destinatário ficam em snapshot; alterar cadastro/template depois não modifica mensagem já preparada. O email não inclui documentos, anexos de contrato ou token de consulta. Os textos devem orientar o cliente a usar o protocolo e token recebidos no pedido.

IN_APP é destinado a funcionários ativos com a permissão do domínio; o histórico só continua visível se a permissão e sessão ainda forem válidas. EMAIL é destinado ao cliente de uma reserva/locação. Endereços e conteúdo da fila de email não são disponibilizados pela caixa de funcionários.

O adaptador envia texto simples por HTTPS ao Resend, com chave estável `locadora-notification-<UUID>`, timeout de 8 segundos e snapshots idênticos nas repetições. A idempotência do provedor dura [24 horas](https://resend.com/docs/dashboard/emails/idempotency-keys); por isso a aplicação interrompe novas tentativas após 23 horas da primeira. Lease expira em 2 minutos, com até 5 tentativas e backoff de 60 segundos por tentativa. Falhas definitivas ou tentativas esgotadas vão para DEAD. Se a última lease for perdida, o próximo claim encerra o job em DEAD. Erros salvos são códigos sanitizados.

SENT no painel significa notificação interna criada; em EMAIL significa **aceita pelo provedor**, sem confirmação de entrega na caixa do destinatário. Webhooks de entrega/bounce não fazem parte desta fase. ADMIN pode revisar jobs e solicitar nova tentativa justificada dentro da janela de idempotência; após a janela, deve reconciliar o resultado no provedor, sem reenviar cegamente. Falha na confirmação do banco após aceitação mantém a lease para recuperação com a mesma chave.

## Configuração de homologação e Supabase

1. Configurar projeto separado de homologação, aplicar as migrations novas sobre 01–21 (ou as 24 num banco vazio), revisar RLS/grants/índices e executar pgTAP, incluindo `007_business.test.sql`, além de `supabase db lint` e os advisors de segurança/performance. Esses checks dependem da stack/projeto real e não foram executados aqui. Não expor `app_private` na Data API. Em banco persistente, não editar migration já aplicada.
2. Validar no PostgreSQL 17 e no HTTP PostgREST com JWT real ADMIN/MANAGER/ATTENDANT/FINANCE, além de usuário inativo, sessão revogada e anônimo. Tentar INSERT/PATCH diretos em ledgers, manutenção e filas. Gerar tipos oficiais e tipar clientes conforme [setup](database/setup.md).
3. Configurar URL/chave publicável, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, origem HTTPS e `APP_TIMEZONE`. Manter `company_settings.timezone` igual ao fuso da aplicação para alertas civis de manutenção; a identidade da empresa é configurada conforme a Fase 7. A service key fica exclusivamente no servidor; operações normais usam sessão do funcionário. As dependências Auth/Storage/Turnstile das fases anteriores permanecem.
4. Em `/admin/financeiro/configuracao`, cadastrar os meios realmente aceitos (dinheiro/Pix/cartão presencial/outros) e os limites de desconto aprovados. Não há seed de saldos ou meios comerciais presumidos. Conferir dados históricos/competência antes de interpretar relatórios.
5. Definir `OPERATIONS_JOBS_SECRET` aleatório com no mínimo 32 caracteres, diferente do segredo de contratos. Configurar um agendador externo para `POST /api/internal/business-jobs`, com `Authorization: Bearer <segredo>`. Sugestão operacional: a cada minuto, ajustando frequência à fila e ao plano de hospedagem. Este documento não cria automação.
6. O endpoint processa lotes de até 100 atrasos, 100 expirações, 100 alertas e 100 eventos; se email estiver configurado, toma até 3 mensagens por execução. Execução concorrente é protegida por transações/leases. Hospedagem precisa de Node 24, duração compatível com 60 segundos e saída HTTPS para o Resend. Não iniciar trabalho depois da resposta HTTP.
7. Sem provedor, deixe `NOTIFICATION_EMAIL_PROVIDER`, `RESEND_API_KEY` e `NOTIFICATION_FROM` vazios: o painel funciona e emails pendentes não consomem tentativas. Para ativar, verificar domínio/remetente no Resend, definir provider `resend`, chave restrita e email simples de remetente (sem nome de exibição). Revisar versões/textos, habilitar apenas as rotas desejadas para CUSTOMER e testar com destinatários controlados. SMTP de recuperação Auth é configuração separada.
8. Configurar também o worker de contratos da [Fase 7](rentals.md). O worker de negócio não gera PDFs. Tanto o agendador quanto o botão manual ADMIN dependem da configuração de servidor; nenhum segredo vai para o navegador.
9. Homologar o percurso completo: cobrar → receber parcialmente → aplicar/devolver caução → reembolsar → cancelar quando cabível; agendar manutenção conflitante → resolver compromisso → concluir com despesa; conferir relatórios/CSV e caixa por cargo. Verificar fila sem provedor, timeout, lease expirada, deduplicação e reconciliação.
10. Definir responsáveis, retenção de snapshots/emails/PII, alertas para DEAD/DISPATCH_FAILED, backlog e restauração. Sentry não foi integrado. Não copiar payloads pessoais, segredos, Authorization ou corpo de mensagens para logs/APM.

A revisão do [changelog PostgreSQL 17.11](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) identificou uma alteração em `btree_gist` sobre floats com NaN. A exclusão desta aplicação usa UUID/range, sem esses floats; outros índices de um projeto compartilhado precisam de revisão própria. Isso não substitui a execução na versão alvo.

## Testes e limites da evidência

`tests/integration/business.mjs` exercita transações reais em conexões distintas: saldos, rollback, idempotência, concorrência, desconto, caução, restituições, cliente divergente, manutenção/ocupação/alertas/fuso, indicadores, relatórios, RLS da caixa e leases/retries. O conjunto completo aplica as 24 migrations do zero. O harness usa PostgreSQL 18.4 e shim Auth/Storage, sem validar criptografia de JWT ou HTTP Supabase.

Testes unitários cobrem centavos, confirmação explícita, schemas, períodos/fuso/DST, CSV e adaptador/worker com transporte simulado. Nenhum email é enviado pela suíte. Playwright cobre falha fechada das telas/APIs e do worker sem configuração em desktop/mobile; o percurso autenticado e a acessibilidade das novas telas dependem da stack real.

Contratos HTTP e exemplos em [api/business.md](api/business.md). Não houve escrita remota nem configuração de agendadores nesta entrega.
