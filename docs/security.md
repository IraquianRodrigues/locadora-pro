# Segurança

Fase 9: revisão local de Auth/RBAC/RLS, 30 rotas API, Server Actions/callback, uploads e workers, com inventário e validador OpenAPI. Foram reforçados PDF estrutural em worker limitado, compensação de upload ambíguo, CSP/HSTS e rejeição de chaves privilegiadas no campo público antes do build. Scanner de padrões/imports e auditoria npm não encontraram achados nas regras executadas; isso não é certificação ou pentest. Readiness privada e gate de promoção falham fechado. Resultados, limitações e exigências de homologação em [phase-9.md](phase-9.md) e [acceptance.md](acceptance.md).

Fase 6: catálogo expõe projeções publicáveis; solicitação exige Origin, cookie assinado, Turnstile no servidor, quotas distribuídas por visitante/documento/e-mail, honeypot e tempo mínimo. Ownership da cotação e idempotência não usam identificadores fornecidos como prova de identidade. Intake/aceite guardam dados declarados sem alterar cliente existente; token de status só por cabeçalho. Fotos dependem de publicação explícita e continuam em bucket privado. Configuração e limites em [public-site.md](public-site.md).

## Fundação entregue

- Configuração sensível isolada em módulos `server-only`; `.env*` ignorados, exceto exemplo sem segredos.
- Clientes Supabase separados por contexto. Cliente de serviço não importado pela UI; escopos delimitados: limitador, arquivos, cotação confiável, status mínimo e expiração. CRUD/downloads/decisões da equipe usam sessão/RLS/RPC autorizada.
- Auth/RBAC implementados na Fase 3, com homologação HTTP Supabase pendente. Falta de credenciais mantém o painel fechado, sem modo administrador nem dados de exemplo.
- Cabeçalhos básicos de proteção, sem cache de dados autenticados. Erros visuais genéricos sem stack.
- Logs de infraestrutura limitados a evento/código/ID de correlação; não registrar payload, tokens, CPF, CNH ou corpo de documentos.

## Implementação exigida nas próximas fases

A Fase 5 implementou snapshots imutáveis de preço no servidor, fingerprint sob lock, limites de desconto por cargo, idempotência, decisões com revisão e ocupação com intervalo operacional. A leitura de quotes/quote_items exige permissão de reservas para proteger logística. Token opaco chega em cabeçalho e só seu hash persiste; endpoint mínimo tem quota distribuída e falha fechada. Regras, fronteira de confiança do backend e homologação estão em [reservations.md](reservations.md).

A Fase 4 acrescentou CRUD real, revisão para edição concorrente, arquivamento preservando vínculos, validação brasileira e arquivos privados. Fluxo de uploads, limites, URLs curtas e pendências de tratamento de PDFs/reconciliação estão em [registry.md](registry.md). A leitura de arquivo novo só é liberada após READY e RBAC/RLS; uploads diretos nos buckets dos cadastros foram negados.

Identidade, sessão SSR, revogação por sessão/perfil, RBAC, CSRF e limites Auth abaixo já têm implementação na Fase 3 e testes locais; ver [Auth](authentication.md) para procedimentos e limites. A tabela continua sendo a matriz de segurança para evolução e homologação do sistema completo.

| Controle        | Local / critério de aceite                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Identidade      | Supabase Auth; validar JWT/getUser no servidor; nenhum cadastro público de funcionário                           |
| Sessão          | Cookies SSR, refresh no proxy, respostas `private, no-store`, rotas sensíveis dinâmicas                          |
| Revogação       | Perfil ativo e permissões consultados no banco em cada operação; MFA conforme política                           |
| RBAC e RLS      | Testes positivos e negativos por perfil, anônimo e usuário revogado; evitar escalada por escrita de profile      |
| CSRF            | Origin/Host confiáveis, métodos seguros sem mutações, proteção nativa de Actions e validação em REST             |
| Antispam        | Limites atômicos distribuídos, IP da infraestrutura confiável, desafio e honeypot; sem dados pessoais no limiter |
| Tokens          | Alta entropia, hash no banco, expiração, sem token em logs/referrer; status retorna mínimo                       |
| Uploads         | MIME real e extensão, limite por tipo, UUID no caminho, autorização de vínculo, quarentena quando aplicável      |
| Storage         | Documentos/vistorias/contratos privados; URLs curtas assinadas após RBAC; evidências concluídas imutáveis        |
| SQL             | Parâmetros, FKs/checks, search_path fixo em definer, grants mínimos e RLS; nunca SQL concatenado                 |
| Financeiro      | Recebimento explícito, idempotência, alocação atômica e compensações auditáveis                                  |
| Webhooks        | Sem rotas até integração definida; assinatura, timestamp e proteção de replay quando criadas                     |
| Observabilidade | Allowlist de campos estruturados; Sentry opcional com sanitização e sem PII                                      |
| Retenção        | Política aprovada antes de produção; anonimização compatível com retenção financeira e evidências                |
| Operação        | TLS, segredos segregados por ambiente, backups e restauração ensaiados, alertas e atualização de dependências    |

## Modelo de ameaças

Atacantes incluem visitante automatizado, funcionário com perfil insuficiente, token expirado/revogado e cliente concorrente. Ativos: documentos pessoais, caixa, contratos, provas de vistoria e disponibilidade. Fronteiras: navegador/servidor, servidor/banco, worker/Storage e notificações externas.

Testes obrigatórios: acesso direto à REST do Supabase, troca de IDs, elevação de papel, mutation por GET, token de status inválido/expirado, upload adulterado, duas aprovações concorrentes, dois pagamentos com mesma chave e excesso de alocação financeira. Antes de produção: revisão das policies, varredura de segredos, auditoria npm, revisão de contrato e teste de restauração.

Não afirmar conformidade LGPD apenas com estes controles técnicos. Responsáveis, base legal, avisos, contratos e retenção ainda precisam de definição pela empresa.
