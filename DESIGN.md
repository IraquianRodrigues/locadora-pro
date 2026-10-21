---
name: "Apex Direção"
description: "Sistema visual compartilhado pelo site público e pela operação Apex."
colors:
  background: "#ffffff"
  foreground: "#29272c"
  primary: "#941b30"
  secondary: "#f5e9ed"
  secondary-foreground: "#841a2c"
  muted: "#f4f2f4"
  muted-foreground: "#6d626b"
  destructive: "#b42318"
  border: "#e2dce1"
  input: "#d4cbd2"
  ring: "#a82d43"
  shell: "#28272b"
  brand-deep: "#81182a"
typography:
  display:
    fontFamily: "Manrope, Arial, Helvetica, sans-serif"
    fontSize: "clamp(2.5rem, 4.8vw, 4.5rem)"
    fontWeight: 750
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope, Arial, Helvetica, sans-serif"
    fontSize: "2.6rem"
    fontWeight: 650
    lineHeight: 1.22
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope, Arial, Helvetica, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.03em"
  section:
    fontFamily: "Manrope, Arial, Helvetica, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.6
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Manrope, Arial, Helvetica, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  navigation-public:
    fontFamily: "Manrope, Arial, Helvetica, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.6
  field-label:
    fontFamily: "Manrope, Arial, Helvetica, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.6
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  5: "1.25rem"
  6: "1.5rem"
  8: "2rem"
  10: "2.5rem"
  12: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.lg}"
    padding: "0.625rem 1.25rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0.625rem 1.25rem"
  button-ghost:
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0.625rem 1.25rem"
  button-hover-neutral:
    backgroundColor: "{colors.muted}"
  period-field:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.7rem"
  navigation-item:
    textColor: "#e1dce3"
    rounded: "{rounded.md}"
    padding: "0.65rem 0.9rem"
  navigation-item-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
  availability-status:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.8rem"
  card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
  operation-band:
    backgroundColor: "{colors.brand-deep}"
    textColor: "{colors.background}"
    rounded: "{rounded.lg}"
    padding: "1.5rem 1.7rem"
---

# Design System: Apex Direção

## Overview

**Creative North Star: "Apex Direção"**

A identidade traduz a clareza da sinalização em uma interface de locação: destinos reconhecíveis, leitura alinhada e ação evidente. Site público e área da equipe compartilham branco, grafite, vermelho profundo e uma única família tipográfica.

O metal vermelho fica na assinatura visual e na arte decorativa de marca. A área de trabalho usa superfícies claras, divisórias e dados abertos; o trilho grafite organiza a navegação. A presença da marca vem da cor e da hierarquia, sem revestir cada indicador de decoração.

**Key Characteristics:**

- Uma identidade Apex no site, no acesso e no painel.
- Branco de trabalho, trilho grafite e vermelho para ações e seleção.
- Manrope local, ícones Lucide e numerais tabulares.
- Dados em linhas abertas; containers usados conforme o conteúdo.
- Metal decorativo com procedência, separado de fotografias da frota.

Escopo registrado: implementação em `src/app/globals.css`, layout raiz e componentes compartilhados, públicos, de autenticação, período e visão geral. O contrato aprovado está em `.impeccable/apex-direction-contract.md` e `.impeccable/surfaces/src-app.md` (seed `3486ba3c97bf52f0`). Este documento descreve código realizado; não comprova dados remotos ou uma sessão autenticada.

## Colors

A paleta combina vermelho profundo com neutros de leve matiz rosada. Os valores normativos estão no frontmatter, extraídos das propriedades de `globals.css`; cores pontuais de ilustração, texto inverso e estados não formam novas paletas de produto.

### Primary

- **Vermelho Apex** (`primary`): botões, seleção do menu, links e ênfase no título público. O alias CSS `accent` usa a mesma cor.
- **Vermelho profundo** (`brand-deep`): faixa operacional e fundo do acesso desktop.
- **Rosa de apoio** (`secondary`) e **vermelho de apoio** (`secondary-foreground`): superfícies suaves e texto secundário relacionado à marca.
- **Vermelho de erro** (`destructive`): papel semântico de falha. Formulários existentes também usam classes utilitárias vermelhas de erro; não há uma escala de erro unificada nesta extração.
- **Vermelho de foco** (`ring`): indicador de teclado em superfícies claras; sobre grafite e faixa operacional, o contorno é branco.

### Neutral

- **Branco** (`background`): fundo de trabalho, cartões e texto inverso. Os aliases CSS `card`, `primary-foreground` e `accent-foreground` também são brancos.
- **Grafite de texto** (`foreground`): títulos e conteúdo principal.
- **Grafite de navegação** (`shell`): trilho administrativo e faixa pública de processo.
- **Névoa rosada** (`muted`): estados vazios, avisos, cabeçalhos de tabela e campos desabilitados.
- **Cinza de leitura** (`muted-foreground`): descrições, legendas e contexto.
- **Divisória suave** (`border`): linhas e contornos de containers.
- **Contorno de campo** (`input`): limites dos controles de formulário.

### Named Rules

**The Marca Compartilhada Rule.** Site, acesso e painel usam a mesma família cromática; a densidade muda conforme a tarefa.

**The Metal de Assinatura Rule.** O material metálico pertence à identidade decorativa, sem virar fundo de dados, fotografia de veículo ou logotipo oficial.

## Typography

**Display Font:** Manrope, com Arial, Helvetica e sans-serif como fallback.
**Body Font:** a mesma família; não há face mono separada.

A fonte variável é auto-hospedada em `assets/fonts/Manrope-Variable.ttf` (pesos 200–800), carregada por `next/font/local`, com licença em `assets/fonts/Manrope-OFL.txt`. Pesos intermediários dão presença aos títulos e leitura compacta aos registros.

### Hierarchy

- **Display:** título público com largura de aproximadamente 11 caracteres por linha; usa o papel `display`. No celular, recebe tamanho fixo (2.8rem) e limite de 12ch.
- **Headline:** mensagem factual do acesso desktop; usa `headline`. Esse bloco desaparece no celular.
- **Title:** título principal administrativo; usa `title`. No celular, reduz para (1.7rem). O título do formulário de acesso usa (2rem), peso (700) e tracking (-0.035em).
- **Section:** seções de dados e finanças usam `section`. O site tem títulos de seção maiores (1.8rem), reduzidos para (1.5rem) no celular.
- **Body:** usa `body`; descrições de interface frequentemente reduzem para (0.8125rem) ou (0.875rem). O parágrafo do hero tem limite de (43ch) e entrelinha (1.85).
- **Navigation / Label:** navegação pública usa `navigation-public`; rótulos de período usam `field-label`. Rótulos de grupos do menu e o descritor da marca são pequenos textos utilitários em caixa alta, não um padrão para adicionar chamadas decorativas.
- **Numbers:** tabelas e elementos `numeric` usam numerais tabulares. Totais de frota usam (2rem); resumos financeiros usam (1.5rem), reduzidos para (1.3rem) no celular.

### Named Rules

**The Uma Família Rule.** Manrope sustenta títulos, navegação e conteúdo; ícones são SVGs Lucide, sem substituir texto ou inventar uma segunda voz tipográfica.

## Layout

A composição pública usa containers de (1280px) para cabeçalho e hero e (1216px) para seções e rodapé. O hero tem duas colunas (1.06fr / 1fr), intervalo de (3rem) e padding de (3.5rem 2rem). A arte é um bloco próprio, sem ocupar o fundo da leitura.

O shell administrativo tem trilho de (232px) e conteúdo flexível com `minmax(0, 1fr)`. O conteúdo central chega a (1600px), com padding de (2rem 2.5rem 3rem); o cabeçalho tem altura mínima de (68px). No breakpoint de (1100px), o trilho passa para (208px) e o padding central para (1.7rem). A rolagem do trilho é nativa, com trilha grafite e thumb legível.

A largura de (767px) marca a composição móvel: menu expansível no lugar do trilho; uma coluna no hero, ações operacionais, dados e finanças; margem horizontal principal de (1.25rem). O formulário de período mantém duas datas flexíveis e botão em linha inteira. O menu móvel limita a altura a (75svh), permite rolagem e cabe na viewport. O acesso troca as duas metades por marca e formulário em sequência, removendo a arte e a narrativa lateral.

A escala extraída em `spacing` representa passos recorrentes de utilitários e CSS, não propriedades customizadas adicionais. Intervalos específicos de composição continuam locais: não promover cada medida a token. Listas de disponibilidade e registros usam divisórias; o catálogo usa cartões em grade responsiva.

## Elevation & Depth

A estrutura é plana: branco, grafite, vermelho e divisórias comunicam as camadas. Cartões e botões não usam sombra decorativa de repouso. A arte metálica fornece materialidade apenas nas superfícies de marca.

### Shadow Vocabulary

- **Menu móvel:** `0 12px 25px #27132026`; separa o painel suspenso da página. É uma sombra suave, sem deslocamento duro de estilo neobrutalista.
- **Foco:** contorno de (2px), com afastamento de (4px) para links e botões e (2px) para campos. Botões e campos de acesso também recebem anel definido pelas suas classes.

### Named Rules

**The Plano de Trabalho Rule.** Dados e containers permanecem planos; a sombra registrada pertence ao menu móvel suspenso.

## Shapes

Cantos são moderados: a escala `sm`–`xl` deriva do raio CSS base (0.5rem), enquanto `2xl` e `full` aparecem nos componentes de catálogo e badges. Controles principais usam `lg`, campos de período e itens de navegação usam `md`, e cartões compartilhados usam `xl`. O catálogo usa `2xl`; badges utilitários usam a forma de pílula.

Contornos finos e divisórias acompanham as superfícies claras. A faixa metálica superior tem altura de (3px) e gradiente próprio; é assinatura, não uma borda a repetir em todos os containers.

## Components

### Buttons

Claros e conhecidos, com texto de ação e ícone opcional.

- **Shape:** raio `lg`, altura mínima de (44px), texto de (0.875rem), peso (600) e ícones de (16px).
- **Primary:** vermelho Apex e texto branco; padding padrão no frontmatter. O tamanho pequeno usa (0.5rem 0.75rem); o grande, (0.75rem 1.5rem).
- **Hover / Focus:** a opacidade do fundo primário reduz para (90%) no hover e (80%) ao pressionar; foco tem anel e afastamento. Desabilitado reduz opacidade para (50%) e impede interação.
- **Outline / Ghost:** contorno fino sobre branco ou ausência de contorno; hover recebe superfície muted. O variant `accent` é um alias visual da cor primária.

### Chips

O estado de preparação combina ícone, texto e fundo rosa suave, usando `availability-status`; comunica estado, sem comportamento de filtro. O badge compartilhado tem contorno, raio `full`, texto (0.75rem), peso (600) e padding de (0.25rem 0.75rem). Não há filtro selecionável a documentar aqui.

### Cards / Containers

O cartão compartilhado é branco, com contorno e raio `xl`; cabeçalho usa padding de (1.5rem), conteúdo usa laterais e base de (1.5rem). Não recebe sombra. O catálogo usa cantos `2xl`, conteúdo com padding de (1.25rem) e imagem de proporção (8/5). Sem foto publicada, exibe superfície muted e ícone de veículo, sem imagem inventada.

Estados vazios usam fundo muted, raio `lg`, padding de (2rem 1.5rem) e altura mínima de (175px). As linhas de dados mantêm rótulo à esquerda e valor tabular à direita, separados por bordas.

### Inputs / Fields

Campos de período usam borda input, raio `md`, altura mínima de (42px) e tipografia de (0.8125rem). Campos de acesso têm altura mínima de (48px), raio `lg`, espaço reservado para o botão de senha e labels explícitos. Foco tem contorno vermelho visível; desabilitado usa superfície muted.

Mensagens de validação ficam junto ao campo, com associação por `aria-describedby` e estado inválido. O acesso indisponível mostra aviso textual e controles desabilitados. O controle de senha tem nome acessível e estado pressionado; cor não é a única indicação.

### Navigation

O menu público é horizontal em desktop e expansível no celular, com entrada de equipe em botão outline. O menu administrativo usa grafite, ícones Lucide e texto claro; o destino atual recebe fundo primário e `aria-current="page"`. Hover usa branco translúcido e foco branco. Os grupos são categorias de navegação; o menu fecha ao escolher um destino no celular. Barras de rolagem preservam o fundo grafite.

### Faixa operacional

A faixa usa vermelho profundo e texto branco, com três destinos quando as permissões e os dados os permitem. Ícone, contagem contextual, título e explicação formam cada link. No hover, a seta avança (4px) em (180ms ease-out) e o título recebe sublinhado; foco branco permanece evidente. No celular, os destinos se empilham.

O movimento se limita a feedback de estado: transições de navegação duram (180ms) e não há animação de entrada. `prefers-reduced-motion` desativa a rolagem suave e reduz durações de animação/transição a (0.01ms).

## Do's and Don'ts

### Do:

- **Do** usar a identidade Apex compartilhada nas superfícies públicas e internas.
- **Do** manter foco visível, labels explícitos, ícones consistentes e numerais tabulares.
- **Do** apresentar estados de preparação, acesso indisponível e ausência de foto com texto verdadeiro.
- **Do** usar somente imagens de veículos publicadas e identificar fixtures de prévia como ilustrativas.
- **Do** manter arte metálica decorativa com procedência e controles móveis roláveis.

### Don't:

- **Don't** tratar o lettering tipográfico ou a arte metálica como logotipo oficial fornecido.
- **Don't** apresentar a arte decorativa como fotografia da frota.
- **Don't** inventar slogans, preços, contatos, depoimentos ou desempenho.
- **Don't** usar previews ilustrativos como evidência de dados reais ou acesso autenticado.
- **Don't** transformar o metal e as sombras em revestimento dos indicadores.

Limites não canonizados: a extração não unifica todas as cores utilitárias de validação nem declara revisão visual integral de rotas fora do escopo. Auth remota, chave de servidor e primeiro administrador continuam adiados; o design não autoriza bypass de RBAC ou publicação do catálogo. Os dois ajustes apontados no finish review — títulos factuais e scrollbar grafite — já constam nas fontes lidas; a documentação não substitui o verdict final.
