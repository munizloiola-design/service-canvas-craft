## Refatoração visual: Deep Glassmorphism + Mesh Gradients

Aplicação global sem tocar em lógica de negócio. Foco em `src/styles.css`, primitives shadcn e shells de layout.

### 1. `src/styles.css` — tokens + utilitários novos
- **Mesh background global** no `body`:
  - Light: `background: radial-gradient(1200px 800px at 10% -10%, oklch(0.98 0.05 160 / .55), transparent 60%), radial-gradient(1000px 700px at 110% 10%, oklch(0.94 0.06 235 / .45), transparent 60%), linear-gradient(135deg, oklch(0.985 0.004 250), oklch(0.965 0.008 250));`
  - Dark equivalente com tons `slate-950 / indigo-950/20 / slate-900`.
- Novos tokens:
  - `--glass-bg`, `--glass-bg-strong`, `--glass-border`, `--glass-shadow` (light + dark via `.dark`).
  - `--gradient-primary: linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 70%, var(--accent)));`
  - `--gradient-text: linear-gradient(90deg, var(--primary), var(--accent));`
  - `--shadow-glow: 0 10px 40px -10px color-mix(in oklab, var(--primary) 45%, transparent);`
- Utilitários (`@utility`):
  - `glass` → aplica bg translúcido + `backdrop-filter: blur(24px) saturate(140%)` + borda + shadow suave.
  - `glass-strong` → variante mais opaca para modais.
  - `text-gradient` → `bg-clip-text text-transparent` sobre `--gradient-text`.
  - `btn-gradient` → fundo com `--gradient-primary`, glow suave, `hover:scale-[1.02] transition-all duration-300`.
  - `focus-ring-gradient` → `ring` em foco com cor primária.
- Regras base:
  - `.dark` tokens definidos (slate/indigo) para deixar preparado; sem toggle novo.
  - Bordas globais mais suaves: `--radius` de 0.875rem → **1rem** (leve arredondamento a mais).

### 2. Primitives shadcn (defaults com glass)
Editar apenas o `className` base dos componentes:
- `src/components/ui/card.tsx` → `glass rounded-2xl` como default (mantém overrides que já usam `rounded-xl` etc.).
- `src/components/ui/dialog.tsx` (DialogContent) → `glass-strong rounded-2xl`.
- `src/components/ui/sheet.tsx` (SheetContent) → `glass-strong`.
- `src/components/ui/popover.tsx`, `dropdown-menu.tsx` (Content), `select.tsx` (SelectContent), `command.tsx` → `glass rounded-xl`.
- `src/components/ui/input.tsx` e `textarea.tsx` → fundo `bg-white/50 dark:bg-white/5 backdrop-blur-sm`, focus com anel gradiente.
- `src/components/ui/button.tsx` → adicionar variante `premium` com `btn-gradient shadow-[var(--shadow-glow)]`; **variante `default` ganha** `bg-gradient-to-r from-primary to-[color-mix(in_oklab,var(--primary)_82%,var(--accent))]` + `hover:scale-[1.02] transition-all duration-300` + glow leve. `outline/ghost/secondary` ficam como estão para não perder legibilidade.

### 3. Shells (`src/routes/_app.tsx` + `src/routes/login.tsx`)
- **Sidebar desktop e mobile header**: trocar `bg-sidebar` por `glass` respeitando `branding.sidebar_color` (aplicado via `background-color` inline com alpha ~0.55 usando `color-mix`, mantendo backdrop-blur). Se o admin escolheu cor sólida, ela vira base translúcida.
- **Área principal**: remover `bg-background` sólido; o mesh do body aparece.
- **Login**: título principal com `text-gradient`, botões primários com nova variante default (já ganha gradiente + glow), card de login com `glass-strong rounded-3xl`.

### 4. Dashboard e destaques
- Aplicar `text-gradient` nos `<h1>` de:
  - `src/routes/_app/dashboard.tsx`
  - `src/routes/_app/financeiro.tsx`
  - `src/routes/_app/parceiros.tsx`
  - `src/routes/_app/tempo.tsx`
  - `src/routes/_app/squad.relatorio.tsx`
  - `src/routes/_app/clientes-area.tsx`
- Sem mexer em nada mais dessas telas — Cards já herdam o glass via primitive.

### 5. Acessibilidade / contraste
- Manter `--foreground` escuro no light; garantir que texto em cima do glass mantém contraste (fundo mesh é claro).
- Dark tokens definidos para futuro toggle; a UI atual continua em light mode. Não vou adicionar toggle de tema — se quiser, peço num turno separado.

### Fora do escopo (para não quebrar)
- Não altero cores da paleta (`--primary`, `--accent`), só como são usadas.
- Não altero `branding-context` (admin continua escolhendo sidebar_color); apenas passa a ser aplicada como base translúcida.
- Não crio toggle dark/light.
- Charts/Recharts mantêm cores atuais.

### Pergunta rápida (opcional)
Já ativo um **toggle de dark mode** no header agora, ou deixo só os tokens preparados para ativar depois?  
Se não responder, **deixo apenas preparado** — a UI segue em light mode com mesh + glass.
