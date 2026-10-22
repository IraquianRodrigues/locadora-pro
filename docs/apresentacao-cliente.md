# Apex — Gestão de Locação de Veículos

## Resumo para apresentação

A Apex reúne o atendimento ao cliente e a operação da locadora em um único sistema web. A solução organiza a frota, os cadastros, os preços, as reservas, a retirada e a devolução dos veículos, as vistorias, os contratos e os registros financeiros.

O cliente pode consultar o catálogo publicado, solicitar uma cotação e enviar um pedido de reserva. A equipe analisa a solicitação, confirma a disponibilidade e acompanha cada etapa da locação. A gestão tem acesso aos indicadores e relatórios conforme as permissões de cada pessoa.

A interface foi desenvolvida com a identidade da Apex, em vermelho metálico e branco, para uso no computador e no celular.

## O que o sistema oferece

| Área                        | O que a locadora pode fazer                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Site e catálogo             | Apresentar os veículos, categorias, características, fotos autorizadas, contatos e políticas da empresa.                                                     |
| Atendimento e reservas      | Preparar cotações detalhadas, receber pedidos online, analisar, aprovar, rejeitar ou cancelar reservas e permitir consulta por protocolo e token privado.    |
| Frota e unidades            | Organizar veículos por categoria e unidade, acompanhar situação, quilometragem, documentos e histórico de locações/manutenção.                               |
| Clientes e condutores       | Manter cadastros de pessoas físicas e jurídicas, contatos, endereços, documentos e informações da CNH dos condutores.                                        |
| Planos, preços e adicionais | Definir planos de diária, semana ou mês, preços por categoria/veículo, vigências, serviços extras, cauções e regras de cobrança.                             |
| Locações e logística        | Converter reservas em locações ou iniciar atendimentos diretos, organizar entrega/coleta, registrar retirada, prorrogação, atraso, devolução e encerramento. |
| Vistorias e documentos      | Usar checklists, registrar quilometragem, combustível, observações, fotos e avarias na saída e no retorno.                                                   |
| Contratos                   | Gerar contratos e aditivos em PDF a partir de modelos revisados e aprovados pela empresa, preservando as versões.                                            |
| Financeiro                  | Controlar cobranças, recebimentos confirmados, pagamentos parciais, créditos, despesas, cauções e registros de reembolsos.                                   |
| Manutenção                  | Agendar e acompanhar serviços, bloquear a agenda quando necessário e identificar vencimentos por data ou quilometragem.                                      |
| Gestão e relatórios         | Consultar indicadores de operação, recebimentos, despesas, saldos, ocupação, atrasos, recorrência e manutenção, com exportação da página em CSV.             |
| Equipe e configurações      | Definir acessos por função, configurar regras e publicação do site e acompanhar notificações internas e filas de processamento.                              |

## Como funciona no dia a dia

1. **O cliente encontra a oferta.** Consulta os veículos publicados e informa período, plano e serviços desejados para receber uma cotação.
2. **A equipe confirma a reserva.** Analisa o pedido, confere as condições e atribui o veículo disponível. Enviar o pedido não garante a reserva automaticamente.
3. **A locadora prepara a retirada.** Confere cliente e condutores, documentos, vistoria, contrato e os requisitos de pagamento/caução definidos pela empresa.
4. **A operação acompanha a locação.** Registra retirada, logística e eventuais prorrogações, com nova verificação de disponibilidade.
5. **A devolução fecha o ciclo.** Registra vistoria final, quilometragem, combustível e eventuais cobranças previstas; conclui os acertos financeiros e encerra a locação.

Os compromissos dos veículos são verificados para evitar conflitos entre reservas confirmadas, locações, manutenções e bloqueios. Alterações e decisões importantes preservam o histórico da operação.

## Benefícios para a Apex

- **Informação centralizada:** atendimento, frota, documentos e valores relacionados à mesma operação.
- **Mais clareza no atendimento:** cotação detalhada, situação da reserva e etapas de retirada/devolução identificadas.
- **Controle da disponibilidade:** verificação dos compromissos antes de confirmar o veículo.
- **Organização financeira:** cobranças, recebimentos e cauções tratados separadamente, com histórico dos ajustes.
- **Rastreabilidade:** registros das condições contratadas, vistorias, documentos e decisões da equipe.
- **Acesso por responsabilidade:** administração, gestão, atendimento e financeiro com permissões diferentes.

Esses recursos apoiam a rotina da locadora; a redução de tempo, custos ou falhas deve ser avaliada durante o uso, sem promessa de resultado numérico antes da implantação.

## Pontos importantes da entrega

O financeiro registra pagamentos e devoluções de valores confirmados pela equipe. A transferência do dinheiro continua sendo feita nos meios usados pela locadora; não há cobrança automática por Pix/cartão ou integração bancária nesta entrega.

Os contratos são gerados em PDF e incluem campos de assinatura. A assinatura eletrônica e a aprovação jurídica dos modelos não fazem parte da geração automática do documento.

Os relatórios distinguem faturamento, recebimento, caução e despesas. O resultado por veículo é uma visão gerencial dos valores contratados e despesas vinculadas, sem substituir a contabilidade da empresa.

As notificações internas estão previstas no painel e dependem do processamento das filas. E-mails dependem de configuração adicional; o envio e a recuperação de senha por e-mail ainda não estão ativos no ambiente atual. O sistema não envia mensagens automáticas por WhatsApp.

## Situação atual e entrada em operação

Em **22/10/2026**, os módulos principais e a identidade visual estão implementados, o banco está configurado e o primeiro acesso real do administrador foi confirmado. O sistema ainda não foi publicado para operação comercial.

Para entrar em operação, a próxima etapa é cadastrar os dados reais da Apex e aprovar preços, políticas, checklists e contratos. Em seguida, serão concluídos os testes do ciclo completo com a equipe, a configuração de segurança e serviços de produção, o domínio/hospedagem, as tarefas automáticas e os procedimentos de backup.

As demonstrações com dados ilustrativos servem para apresentar a interface; não representam frota disponível, preços comerciais ou transações reais.

## Texto curto para falar ao cliente

> A Apex terá um sistema que conecta o site da locadora ao trabalho da equipe. O cliente poderá consultar os veículos e solicitar uma reserva; internamente, a empresa poderá organizar a frota, conferir disponibilidade, preparar contratos e vistorias e acompanhar a locação até a devolução. A gestão terá controle dos recebimentos, cauções, despesas, manutenções e relatórios, com acessos definidos para cada função. A base já está implementada e o administrador já acessou o ambiente real. Agora vamos concluir os cadastros e a validação com a equipe antes da publicação.

## Roteiro sugerido de demonstração

1. Apresentar a identidade Apex no site e no painel.
2. Mostrar uma ficha de veículo e a organização de clientes/condutores.
3. Demonstrar a cotação e explicar a aprovação manual da reserva.
4. Percorrer retirada, vistoria, contrato e devolução.
5. Mostrar a separação entre recebimentos, cauções e despesas.
6. Encerrar com manutenção, relatórios e as etapas restantes da implantação.
