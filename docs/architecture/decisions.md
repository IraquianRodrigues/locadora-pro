# Decisões arquiteturais e pendências

## Adotadas

| ADR | Decisão                                                            | Motivo / consequência                                                                                                                       |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 001 | Monólito modular em Next.js                                        | Menos operação inicial; serviços e outbox permitem extração futura                                                                          |
| 002 | Supabase PostgreSQL/Auth/Storage                                   | RLS e SQL transacional; migrations são fonte do schema                                                                                      |
| 003 | Uma empresa; sem tenancy                                           | Unidades são operacionais, não isolamentos de empresas                                                                                      |
| 004 | Alocação central com GiST                                          | Integridade entre reservas, locações e bloqueios sob concorrência                                                                           |
| 005 | Atribuir veículo na aprovação por categoria                        | Capacidade corresponde a veículos reais, sem overbooking                                                                                    |
| 006 | Valores em decimal e snapshots                                     | Reprodução de contrato e integridade financeira                                                                                             |
| 007 | Sessão Supabase por cookies SSR                                    | Validação no servidor em cada entrada; sem confiança em getSession isolado                                                                  |
| 008 | Cliente de usuário como padrão                                     | Service role restrita a bootstrap/worker/casos públicos auditados                                                                           |
| 009 | Outbox e workers idempotentes                                      | Envio de e-mail não decide o sucesso da transação                                                                                           |
| 010 | Sem integração financeira online no MVP                            | Recebimento explicitamente confirmado na retirada                                                                                           |
| 011 | npm e lockfile único                                               | Ferramentas já disponíveis e reprodução por npm ci                                                                                          |
| 012 | Implantação inicialmente fechada                                   | Fases 0/1 não oferecem reservas ou login fictícios                                                                                          |
| 013 | ESLint 10 com presets TS/Hooks e acessibilidade via axe/Playwright | eslint-config-next 16.4.2 traz braces sem correção; evitar dependência vulnerável em vez de downgrade do framework ou override incompatível |

TypeScript 5.9.3 é fixado como linha conservadora compatível com parser e Next; TypeScript 7.0.2 já é estável no registro, mas sua adoção fica para avaliação específica. O preset específico do Next pode ser reavaliado quando sua cadeia não depender do pacote afetado. A ausência dele não substitui testes de build/rotas e a revisão de limites servidor/cliente.

O parser instalado declara TypeScript < 6.1; não adotar TS 7 sem atualização compatível. ESLint 9 foi descartado após aviso de fim de suporte. O plugin JSX a11y estável ainda limita seus peers ao ESLint 9; a base final usa ESLint 10 suportado, regras TS/Hooks e testes de acessibilidade no DOM com axe. Não há peer dependencies forçadas na árvore final.

## Decisões comerciais pendentes

| Tema                                                        | Necessário até       | Tratamento até decisão                                |
| ----------------------------------------------------------- | -------------------- | ----------------------------------------------------- |
| Razão social, CNPJ, unidades, contatos e identidade         | Fase 6/7             | Não publicar dados empresariais inventados            |
| Tarifas, mês comercial/calendário, pacotes e vigência       | Fase 5               | Configuração obrigatória; não cotar sem tarifa válida |
| Tolerância, arredondamento, atraso e preparo entre locações | Fase 5/7             | Regra versionada; sem valor implícito em produção     |
| Requisitos de idade/CNH, condutores adicionais, franquia km | Fase 4/7             | Validar documentos e regras antes do check-out        |
| Caução, descontos por cargo, multas e reembolsos            | Fase 5/8             | Negar operações não configuradas                      |
| Área, horários e taxas de entrega/coleta                    | Fase 5/6             | Taxas fixas configuradas; sem cálculo de distância    |
| Expiração da solicitação e orçamento                        | Fase 5               | Política explícita e tarefa assíncrona auditável      |
| Checklist, evidências e critérios de encerramento           | Fase 7               | Check-out/check-in bloqueados sem configuração        |
| Termos e template de contrato                               | Fase 7               | Rascunho sujeito à revisão jurídica                   |
| Prazo de retenção e atendimento LGPD                        | Antes de dados reais | Documentar responsável e política; acesso mínimo      |

## Dependências operacionais pendentes

- Projeto Supabase de desenvolvimento e homologação, região, backups, restauração e orçamento. Alternativa local exige Docker e CLI.
- Hospedagem, domínio e certificados; nenhum deploy remoto é autorizado implicitamente por esta fundação.
- Provedor de e-mail e remetente verificado. Adaptador desativado por padrão; não registrar corpo com dados pessoais.
- Worker e agendamento (cron/serviço), retries, monitoramento e dead letters.
- Sentry opcional, sanitização e consentimento/custos antes da ativação.
- Antispam público: provedor ou desafio; limite distribuído via banco/infra confiável, sem contador local em memória.
- Política de MFA e bootstrap do primeiro administrador fora do cadastro público.

As pendências não impedem a base local. Impedem declarar módulos dependentes prontos para produção. Não instalar serviços pagos sem autorização.
