# Desenvolvimento e implantação

**Preparação da Fase 9:** pacote standalone, Dockerfile sem root, readiness privada, gate de promoção, scripts/CI e ensaio local disponíveis. São 25 migrations e 64 tabelas. Não houve deploy remoto nem build de imagem sem Docker. O procedimento atual, incluindo rollback e recuperação, está em [phase-9.md](phase-9.md); a [matriz de aceite](acceptance.md) identifica pendências para promoção. As seções por fase abaixo são contexto histórico.

## Estado atual

Fases 0–8 implementadas localmente, incluindo locações/contratos e financeiro/manutenção/relatórios/notificações. São 24 migrations e 64 tabelas, com testes SQL isolados, unitários e fronteiras HTTP/browser. Não houve deploy, criação de projeto ou contratação de serviços. Validar a stack Supabase e homologar antes de aceitar dados operacionais. Veja [banco](database/setup.md), [Auth](authentication.md), [cadastros/Storage](registry.md), [locações/PDF](rentals.md) e [operação da Fase 8](business-operations.md).

## Variáveis

Fase 6: configurar também `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY`, hostname do widget e acesso HTTPS à Siteverify. Publicar site/planos/adicionais/fotos explicitamente pelo painel, com textos aprovados. Fase 7: `RENTAL_JOBS_SECRET` e agendador do worker de contratos. Fase 8: `OPERATIONS_JOBS_SECRET` e agendador de `POST /api/internal/business-jobs`; email opcional com `NOTIFICATION_EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `NOTIFICATION_FROM` e rotas aprovadas no painel. Todos os segredos ficam exclusivamente no servidor. Manter `company_settings.timezone` alinhado a `APP_TIMEZONE`. Procedimento completo em [business-operations.md](business-operations.md).

| Variável                             | Contexto                                                    | Obrigatória                                                |
| ------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------- |
| NEXT_PUBLIC_APP_URL                  | Origem canônica pública para links/callbacks futuros        | Produção; localhost como padrão dev                        |
| NEXT_PUBLIC_SUPABASE_URL             | URL do projeto, não segredo                                 | Ao ativar Supabase                                         |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Chave publicável com RLS                                    | Ao ativar Supabase; ambas ou nenhuma                       |
| SUPABASE_SERVICE_ROLE_KEY            | Servidor apenas; nunca NEXT_PUBLIC                          | Limitador, arquivos, cotação confiável, status e expiração |
| AUTH_SECRET                          | Servidor; HMAC de recuperação, limitador e token de reserva | Auth, aleatório, mínimo 32 caracteres                      |
| APP_TIMEZONE                         | Timezone IANA inicial                                       | Padrão America/Fortaleza                                   |

Não renomear chave de serviço com prefixo público. Os clientes browser leem somente as duas variáveis públicas explícitas. A ausência de configuração permite visualizar a fundação, mas qualquer criação de cliente Supabase falha com erro controlado. Configuração parcial/inválida é recusada. Não utilizar dados mockados para compensar banco ausente.

## Banco (Fase 2)

Instalar Docker e Supabase CLI 2.121.0 ou preparar projeto exclusivo de desenvolvimento. Configuração local, 24 migrations, policies e buckets privados versionados. Revisar legado/constraints NOT VALID e índices conforme `registry.md`, além da atualização de versões em `source_quote_id` conforme `reservations.md`. Testar reset somente local, executar pgTAP e gerar tipos TS. Nunca copiar dados de produção para seed. `npm run test:db` não substitui a stack Supabase. Hospedagem precisa de runtime Node/Sharp e aceitar multipart de até 4 MiB mais overhead; Server Actions limitado a 5 MB. Definir política comercial, agendar RPC de expiração e configurar/monitorar worker de outbox antes do uso operacional.

## Checklist de promoção (Fase 9)

1. Escolher hospedagem Next.js compatível com Node 24 e plano autorizado; separar dev/homologação/produção.
2. Configurar segredos no provedor e origens autorizadas no Supabase Auth. TLS, SMTP e domínio verificados.
3. Executar CI e auditoria, aplicar migrations em homologação e realizar teste de restauração.
4. Cadastrar dados reais da locadora, tarifas e políticas aprovadas; bootstrap ADMIN por canal restrito.
5. Implantar app e worker, confirmar liveness/readiness, e-mails, geração de PDF e alertas.
6. Executar E2E com dados de homologação, revisar logs sem PII e validar RLS por perfil.
7. Aplicar migrations novas em produção com backup/plano de recuperação; não executar reset.
8. Publicar app somente após aceite; monitorar conflitos, falhas de worker, caixa e tempos de resposta.

## Operação

Endpoint `/api/v1/health` é apenas liveness. `GET /api/internal/readiness` usa `READINESS_SECRET` e checks de configuração/Auth/schema/RLS/buckets, sem dados internos. Não comprova entrega de email ou restauração. Contratos e emails usam workers com leases/backoff/dead letters; não confiar em tarefa iniciada após resposta serverless. Procedimento atualizado na Fase 9.

Backups, RPO/RTO, retenção e responsável operacional são decisões pendentes. Rollback de código não pode exigir desfazer migrations destrutivas; preferir expansões compatíveis e correções progressivas. Sentry permanece sem integração. O adaptador de emails de negócio está implementado; envio depende do provedor/remetente e rotas configurados. Recuperação Auth já usa o Supabase, mas a entrega real depende de SMTP e template configurados. Não cachear rotas Auth/admin; suprimir query strings sensíveis em logs/CDN/APM. Réplicas usam o mesmo AUTH_SECRET e banco de limites, sem fallback em memória.
