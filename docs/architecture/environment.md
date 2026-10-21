# Diagnóstico — 19/10/2026

## Inspeção inicial

| Item                  | Resultado observado                                                |
| --------------------- | ------------------------------------------------------------------ |
| Diretório             | `C:\Users\algum\locadora-pro`                                      |
| Código existente      | Diretório inicialmente vazio, sem arquivos ocultos de projeto      |
| Git                   | 2.56.0.windows.2; diretório inicialmente sem repositório           |
| Instruções locais     | Nenhum AGENTS.md nos ancestrais verificados nem no diretório       |
| Shell                 | PowerShell no Windows                                              |
| Node                  | v24.20.0, linha 24 LTS                                             |
| npm                   | 11.19.0                                                            |
| pnpm                  | Comando disponível; npm escolhido para evitar dois lockfiles       |
| Docker / Supabase CLI | Não encontrados no PATH                                            |
| Credenciais           | Não fornecidas; nenhum arquivo de ambiente preexistente            |
| Rede npm              | Sandbox retornou EACCES; consulta repetida com autorização de rede |

## Compatibilidade e pesquisa antes da instalação

Registro npm consultado: Next.js estável 16.4.2; Node mínimo 20.9 e React 19 suportado. Node 24 local atende ao requisito. Versões efetivamente instaladas, auditoria e verificações estão em `docs/verification.md` e no lockfile.

Fontes oficiais consultadas em 19/10/2026:

- [Instalação Next.js](https://nextjs.org/docs/app/getting-started/installation).
- [Segurança Next.js de 14/10/2026](https://nextjs.org/blog/nextjs-security-update-october-14-2026): correções na linha 16 a partir de 16.4.1. Seleção inicial 16.4.2.
- [Node 24 LTS](https://nodejs.org/en/about/previous-releases).
- [Tailwind com Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
- [shadcn/ui com Next.js](https://ui.shadcn.com/docs/installation/next) e [instalação manual](https://ui.shadcn.com/docs/installation/manual).
- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

A auditoria npm é uma verificação pontual de vulnerabilidades conhecidas; não substitui revisão de código ou atualização contínua. Nenhuma integração paga foi ativada. A Fase 1 pode ser executada localmente; testes de banco e homologação dependem de ambiente adicional.
