# Plano: escurecer o menu lateral no modo escuro

## Objetivo
Aplicar a direção visual "Deep charcoal glass" selecionada ao menu lateral da aplicação no modo escuro, deixando-o mais escuro e com acentos sutilmente coloridos, sem perder o efeito de vidro e a leitura dos itens.

## O que será alterado
- `src/routes/_app.tsx`: estilos do `<aside>` do menu desktop, do header mobile e do `SheetContent` mobile.
- Itens de navegação ativos e inativos no modo escuro.

## Mudanças técnicas
1. **Fundo do menu**
   - Desktop: trocar `dark:bg-white/5` por `dark:!bg-sidebar/95` (sobrescreve o inline style de cor da marca quando necessário).
   - Manter `backdrop-blur-xl` para preservar o glassmorphism.
   - Mobile: aplicar o mesmo ajuste no header fixo e no `SheetContent`.

2. **Borda do menu**
   - Desktop: `dark:border-primary/15` no lugar de `dark:border-white/10`.
   - Mobile: mesma alteração.

3. **Itens de navegação**
   - Item ativo no dark: fundo `dark:bg-primary/10`, texto `dark:text-primary`, borda `dark:border-primary/20` e ícone `dark:text-primary`.
   - Item inativo no dark: manter `text-sidebar-foreground/70` com hover em `hover:bg-sidebar-accent/60`.
   - Adicionar `border border-transparent` base para evitar salto de layout quando o item fica ativo.

4. **Cartão do usuário no rodapé**
   - No dark, envolver o bloco do usuário em fundo `dark:bg-white/5` e borda `dark:border-white/10` para dar profundidade, seguindo a referência do protótipo.

## Resultado esperado
Menu lateral visivelmente mais escuro no modo escuro, com itens ativos destacados pela cor primária da aplicação e mantendo o efeito de vidro fosco.