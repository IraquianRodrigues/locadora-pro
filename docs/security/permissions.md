# Matriz de permissões proposta

Permissões são verificadas no servidor e no PostgreSQL. Papel não vem do formulário nem de metadados editáveis pelo usuário. `profiles.active = false` revoga o acesso mesmo com JWT ainda válido. ADMIN é o único perfil que altera concessões; impedir remoção do último administrador ativo em transação.

Estado implementado até a Fase 8: FINANCE lê categorias/tarifas e projeções financeiras mínimas de nomes/identificadores, sem acesso às tabelas operacionais de frota, clientes, reservas, cotações ou documentos. Dashboard e relatórios separam domínios no banco. Manutenção tem escrita somente ADMIN/MANAGER e consulta ATTENDANT; FINANCE registra despesas, mas não acessa o histórico operacional. Notificações exigem destinatário próprio e permissão atual. Configuração/retry de filas é ADMIN. Descontos financeiros exigem `discounts.authorize` e limite acumulado configurado por cargo; FINANCE pode registrar outros créditos autorizados, mas não concede descontos. Detalhes em [business-operations.md](../business-operations.md).

Legenda: R leitura, W criar/editar, A aprovar/executar, — negado. Excluir significa arquivar quando permitido; financeiro e auditoria não permitem apagar histórico.

| Recurso / ação                             | ADMIN | MANAGER            | ATTENDANT               | FINANCE                |
| ------------------------------------------ | ----- | ------------------ | ----------------------- | ---------------------- |
| Dashboard operacional                      | R     | R                  | R limitado              | —                      |
| Dashboard financeiro                       | R     | R                  | —                       | R                      |
| Categorias e frota                         | RW    | RW                 | R                       | R limitado             |
| Bloqueios e manutenção                     | RWA   | RWA                | R                       | R despesas             |
| Clientes e condutores                      | RW    | RW                 | RW                      | R identificação mínima |
| Documentos pessoais / URLs assinadas       | RA    | RA                 | RA operacional          | —                      |
| Tarifas e regras                           | RW    | RW                 | R                       | R                      |
| Desconto comercial                         | A     | A dentro do limite | —                       | —                      |
| Reservas: criar/consultar/em análise       | RW    | RW                 | RW                      | R financeiro           |
| Reservas: confirmar/rejeitar               | A     | A                  | —                       | —                      |
| Reserva: cancelar                          | A     | A                  | A solicitada/em análise | —                      |
| Locações: preparar/check-out/check-in      | A     | A                  | A                       | —                      |
| Prorrogar locação                          | A     | A                  | —                       | —                      |
| Vistorias: criar/concluir                  | A     | A                  | A                       | —                      |
| Contratos: gerar/consultar                 | A     | A                  | A operacional           | R valores              |
| Cobranças e recebimentos                   | RWA   | RWA                | —                       | RWA                    |
| Caução, reembolso, estorno, despesa        | RWA   | RWA                | —                       | RWA                    |
| Relatórios operacionais e CSV              | R     | R                  | —                       | —                      |
| Relatórios financeiros e CSV               | R     | R                  | —                       | R                      |
| Usuários, papéis, revogação, configurações | RWA   | —                  | —                       | —                      |
| Auditoria                                  | R     | R operacional      | —                       | R financeiro           |

ATTENDANT não confirma pagamento; a retirada exige interação com um usuário autorizado ao recebimento. Ajustar esta divisão somente mediante decisão registrada da locadora.

## Convenção e aplicação

Permissões atômicas: `vehicles.read`, `vehicles.write`, `reservations.request`, `reservations.review`, `reservations.approve`, `reservations.cancel_pending`, `reservations.cancel_confirmed`, `rentals.checkout`, `rentals.checkin`, `rentals.extend`, `payments.confirm`, `refunds.create`, `documents.read`, `users.manage`, `settings.manage`. O catálogo completo nasce na migration RBAC e terá testes de negação por padrão.

Função SQL `has_permission(text)` consulta usuário ativo e concessões atuais, com `search_path` fixo. Privilégios de execução mínimos, sem parâmetros que substituam a identidade `auth.uid()`. Políticas separadas para leitura e mutação; grants e RLS juntos. Campos restritos exigem views/projeções ou RPCs: RLS por linha não oculta colunas.

## Acesso público

Somente categorias ativas, projeção sanitizada da frota e operações de consulta/solicitação dedicadas. Sem CPF, placa interna se desnecessária, documentos, observações ou dados de outros clientes. Escrita anônima direta nas tabelas fica negada. Endpoint servidor valida, limita e chama função restrita. Consulta de status exige token aleatório de alta entropia, hash persistido, prazo e resposta mínima; UUID sozinho não autoriza nada.
