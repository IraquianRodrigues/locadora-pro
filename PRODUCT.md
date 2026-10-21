# Apex

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Equipe de uma locadora brasileira: administração, gestão, atendimento e financeiro. Clientes consultam o catálogo público, pedem cotação e solicitam reservas para análise da equipe.

## Product Purpose

Organizar frota, clientes, condutores, reservas, locações, retirada/devolução, vistorias, contratos, financeiro e manutenção em uma única operação. Oferecer uma experiência pública clara, com aprovação manual da disponibilidade antes da confirmação.

## Operating Context

O sistema existente usa Next.js, React, TypeScript e Supabase. O painel tem permissões verificadas no servidor. A operação trabalha com reais, documentos brasileiros, horários comerciais e compromissos dos veículos. Site e painel compartilham a identidade Apex, conforme confirmado pelo usuário.

## Capabilities and Constraints

Preservar CRUD, validações, filtros, fluxos transacionais, permissões e proteção de sessões existentes. A configuração Auth, chave de servidor e primeiro administrador no ambiente remoto foi adiada pelo usuário. Não contornar essa proteção para mostrar o design. Prévia com dados ilustrativos deve ser identificada e isolada da aplicação de produção. Não publicar o catálogo nem alterar dados remotos durante o trabalho visual.

## Brand Commitments

Nome confirmado: **Apex**. Cores da loja confirmadas: **vermelho metálico e branco**. O usuário quer site e painel modernos, bonitos e com personalidade, sem aparência genérica de interface feita por IA. Nenhum slogan oficial ou logotipo foi fornecido; não tratar um desenho novo como logotipo oficial.

## Evidence on Hand

Há implementação funcional e testes das fases 0–9 em src/, tests/ e docs/. O projeto remoto possui 26 migrations e 64 tabelas. Não foram fornecidas fotos da frota, contatos comerciais, depoimentos, preços reais nem dados de desempenho da loja; não inventar essas informações. A publicação pública continua condicionada à configuração e decisão do administrador.

## Product Principles

- Mostrar o estado real da operação e o próximo passo de cada tarefa.
- Separar solicitações, confirmações e recebimentos registrados.
- Manter acesso e dados financeiros restritos às permissões atuais.
- Usar a mesma identidade no atendimento público e no trabalho da equipe.
- Preservar leitura, navegação por teclado e uso em telas pequenas.
