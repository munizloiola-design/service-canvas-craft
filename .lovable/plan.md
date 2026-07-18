## Objetivo
Aplicar a identidade visual do template **Invome** (https://invome.vercel.app/index-2.html) em todo o sistema, preservando 100% da lógica, filtros, banco de dados e permissões atuais. A mudança é puramente de camada visual (tokens CSS + estilos de componentes) e adiciona uma tela para personalização de cores/gráficos pelo usuário.

## Referência visual (Invome)
- **Cor primária**: verde profundo (`#1a936f` / `#178a63`) para botões, links ativos e destaques.
- **Fundo**: branco levemente acinzentado (`#f4f6f8`); cards brancos puros com **cantos bem arredondados** (16–20px) e sombras muito suaves (`0 4px 20px rgba(15,23,42,.05)`).
- **Sidebar clara** com logo no topo, cartão de perfil (avatar + nome + papel), itens em maiúsculas suaves, item ativo em verde com barra lateral, submenu recuado com bullets.
- **Tipografia**: display forte para números KPI (Poppins/Plus Jakarta 700), corpo em Inter/Manrope 400–500.
- **KPIs**: card branco com ícone em quadrado colorido (verde-claro), número gigante e label discreta.
- **Gráficos**: donuts com gradientes vibrantes (roxo/rosa, verde-água, laranja/coral, azul/violeta) e barras finas coloridas com pill arredondada.
- **Tabelas**: linhas com bastante respiro, sem bordas verticais, header em texto pequeno e cinza, avatares circulares, badges de status pill.
- **Botões**: primary verde sólido arredondado; secundário outline.

## Escopo das mudanças

### 1. Tokens de design (`src/styles.css`)
Reescrever `:root` com a paleta Invome (via oklch), aumentar `--radius` para `1rem`, criar variáveis novas:
- `--brand-primary` (verde), `--brand-primary-glow`
- `--chart-1` … `--chart-6` (paleta multicolorida dos gráficos)
- `--shadow-card`, `--shadow-elevated`
- Tokens já existentes de shadcn permanecem com nomes iguais (só ajustar valores) — nada quebra.
- Fontes carregadas via `<link>` no `__root.tsx` (Plus Jakarta Sans + Inter). Nada de `@import` remoto no CSS.

### 2. Layout base (`src/routes/_app.tsx` + sidebar)
- Refinar a AppSidebar: bloco de perfil no topo, item ativo com background verde-claro + barra esquerda, ícones em círculo suave, agrupamentos com label em maiúsculo.
- Header: campo de busca arredondado central, ícones de notificação com badge numérico, botão primário verde "Nova ação" à direita.
- Mesmo componente para `_authenticated`/portal (visual coerente).

### 3. Componentes shadcn (via `className`, sem mudar API)
- `Card`: raio maior, sombra suave, padding 24.
- `Button` variant primary: verde sólido, altura 44, raio 12.
- `Table`: linhas 64px, header uppercase text-xs, hover row.
- `Badge`: pill com variantes success/warning/destructive/info alinhadas aos novos tokens.
- `Input`/`Select`: raio 12, borda mais clara, focus verde.
- `Tabs`: underline verde no ativo.

### 4. Dashboard (`_app/dashboard.tsx`)
Reorganizar apenas o **visual** dos KPIs e gráficos existentes seguindo o layout Invome (4 KPIs no topo, área de donuts + barras coloridas, tabela abaixo). Dados/queries inalterados.

### 5. Gráficos (Recharts já usados em Financeiro/Dashboard)
- Aplicar `stroke`/`fill` a partir de `var(--chart-N)`.
- Barras arredondadas (`radius={[8,8,0,0]}`), linhas com `strokeWidth={3}` e gradientes SVG.
- Tooltip com card branco arredondado + sombra.
- **Sem alterar** lógica de agregação nem fontes de dados.

### 6. Personalização (nova aba dentro de `_app/personalizacao.tsx`)
Adicionar aba **"Tema"** com:
- Color picker para: primária, fundo, cartão, cor de destaque.
- 6 color pickers para as cores dos gráficos (`--chart-1..6`).
- Preset "Invome" (verde) e "Personalizado".
- Salva em `app_branding` (colunas novas: `theme_json jsonb`) via migration; ao carregar, `BrandingProvider` injeta as vars CSS no `<html>`.
- Migration adiciona coluna `theme_json` com default do preset Invome + `GRANT` já existente na tabela.

### 7. Portal do cliente (`portal.tsx` + filhos)
Mesmo tratamento visual (cards, header, botões) para manter coerência entre workspace e portal.

## Fora de escopo (não muda)
- Rotas, permissões, RLS, tabelas existentes, filtros, cálculos financeiros, fluxo de confirmações, testes.
- Nenhum componente será removido ou terá props alteradas.
- Não copiaremos código do template Invome (é apenas referência visual).

## Detalhes técnicos
- Fontes: `<link rel="preconnect">` + `<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap">` no `head()` de `__root.tsx`.
- `styles.css`: manter `@import "tailwindcss"` no topo; adicionar tokens em `:root` e mapear em `@theme inline` os que precisam virar utilitários (`--color-chart-1` etc.).
- `BrandingProvider` já injeta variáveis CSS — estender para novos tokens (`--chart-*`, `--radius`, etc.).
- Migration Supabase: `ALTER TABLE app_branding ADD COLUMN IF NOT EXISTS theme_json jsonb DEFAULT '{...preset...}'::jsonb;`
- Sem novas dependências npm.

## Entregáveis
1. `src/styles.css` — nova paleta e tokens.
2. `src/routes/__root.tsx` — links de fonte.
3. `src/lib/branding-context.tsx` — injeção dos novos tokens.
4. `src/components/app-sidebar.tsx` (ou equivalente atual) + `src/routes/_app.tsx` — novo layout sidebar/header.
5. `src/routes/_app/dashboard.tsx` — reorganização visual dos KPIs/gráficos.
6. Ajustes de className em `Card`/`Button`/`Table`/`Badge`/`Tabs` (variantes shadcn locais).
7. `src/routes/_app/personalizacao.tsx` — nova aba "Tema" com pickers + preset.
8. Migration `app_branding.theme_json`.
9. Ajustes de tema nos Recharts do Financeiro e Dashboard.

## Riscos / mitigação
- **Contraste em botões existentes**: manter tokens semânticos (`primary`/`primary-foreground`) — todas as chamadas continuam funcionando.
- **Dark mode**: manter definição de `.dark` para não quebrar quem já usa.
- **Gráficos que hardcoded cor**: substituir por `var(--chart-N)` (busca por `stroke="#` / `fill="#` nos arquivos de gráfico).

Confirma que posso seguir com esse plano?
