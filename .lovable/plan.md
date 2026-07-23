## Objetivo
Centralizar toda personalização visual em uma aba única **"Identidade & Aparência"** (Configurações → exclusiva para Admins), adicionar novos campos de branding (cor do menu, fundo do login, posição da caixa, textos de boas-vindas) e aplicar essa estilização em volta da tela de login **sem alterar** o fluxo de 2 passos (Cliente/Agência → formulário).

## 1. Banco de dados (migration)
Adicionar colunas em `app_branding`:
- `sidebar_color text` (default igual à primary)
- `background_image text null` (URL do bucket `brand-assets`)
- `login_box_position text check in ('left','center','right') default 'right'`
- `welcome_title text default 'Como deseja entrar?'`
- `welcome_subtitle text default 'Escolha o tipo de acesso.'`

Atualizar `BrandingSchema` em `src/lib/branding.functions.ts` e o tipo `Branding` em `src/lib/branding-context.tsx` para incluir esses campos, expor variáveis CSS `--brand-sidebar`, e persistir os novos valores.

## 2. Aba "Identidade & Aparência"
Refatorar `src/routes/_app/personalizacao.tsx` consolidando tudo em **uma única aba** com seções (usando `Card` + separadores, removendo as sub-abas Marca / Tema / Emails para uma tela única — emails ficam em uma sub-seção ao final):

- **Marca & Ícones**: nome do sistema, upload de logo, upload de favicon.
- **Paleta de Cores**: color pickers para Primária, Destaque, Menu Lateral + paleta de gráficos (mantida).
- **Tela de Login**: upload de imagem de fundo, seletor de posição da caixa (`left`/`center`/`right` via `RadioGroup` com preview), inputs de `welcome_title` e `welcome_subtitle`.
- **Templates de e-mail**: mantidos como accordion no final.

Restringir acesso a admins (já filtrado por `can("branding","manage")`).

## 3. Refatoração visual do login (fluxo intacto)
Em `src/routes/login.tsx`, **não mexer** na lógica de `kind`, `onSignIn`, validação de papel ou navegação. Apenas envolver o layout:

- Ler `branding` de `useBranding()`.
- Container raiz: `min-h-screen bg-cover bg-center` com `style={{ backgroundImage: url(branding.background_image) }}` como fallback ao gradiente atual quando ausente.
- Substituir o grid `lg:grid-cols-2` por um flex que respeita `login_box_position` (`justify-start | justify-center | justify-end`). O painel verde esquerdo passa a ser opcional (some quando há `background_image`).
- Na etapa 1, substituir "Como deseja entrar?" / "Escolha o tipo de acesso." pelos valores dinâmicos `welcome_title` / `welcome_subtitle`.
- Aplicar `--brand-primary` via classes existentes (`text-primary`, `bg-primary`) nos ícones dos ChoiceCards, botão "Entrar" e links — já vinculados ao token, então basta garantir que os `Icon` usem `text-primary`.

## 4. Aplicação global
- `BrandingProvider` já injeta `--brand-primary`/`--brand-accent`; adicionar `--brand-sidebar` e aplicar no sidebar do `src/routes/_app.tsx` (classe `bg-[hsl(var(--brand-sidebar))]` ou style inline).
- Favicon já é atualizado via `<link rel="icon">` — nenhuma mudança extra.

## Detalhes técnicos
- Uploads reutilizam o bucket `brand-assets` (já público), pasta `background/`.
- Nenhuma alteração no fluxo de auth, roles ou rotas.
- Migration inclui GRANTs? `app_branding` já existe; apenas `ALTER TABLE ADD COLUMN`, sem novos GRANTs.
- Types regenerados após aprovação da migration.
