Mover o botão de recolher/expandir o menu do `<main>` para dentro do cabeçalho do sidebar (a div do logo/título em `src/routes/_app.tsx`).

### Alterações

1. **Remover** o botão flutuante atualmente localizado em `src/routes/_app.tsx` dentro do `<main>` (linhas 216-226).
2. **Adicionar** o botão de recolher/expandir dentro da div do cabeçalho do sidebar (linha 111), ao lado do logo e do nome da marca.
3. **Ajustar estilos** para que o botão fique alinhado visualmente com o logo e o texto, respeitando o estado colapsado (`desktopCollapsed`).
4. **Manter comportamentos**:
   - Persistência do estado no `localStorage`.
   - Ícone muda entre `PanelLeft` e `PanelLeftClose` conforme estado.
   - Tooltip/aria-label atualizado.

### Resultado esperado

O botão de recolher o menu ficará posicionado dentro do cabeçalho do sidebar, próximo ao logo "DIG.WORKFLOW", em vez de flutuar sobre o conteúdo principal.