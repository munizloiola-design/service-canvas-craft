# Kanban: limitar colunas a 5 tarefas e abrir modal no "+X"

## Problema

Hoje cada coluna do Kanban exibe todas as demandas daquela etapa. Quando uma etapa acumula muitos itens (por exemplo, Produção com 7+ tarefas), a coluna fica longa demais, dificulta a visualização geral do quadro e empurra as colunas seguintes para baixo.

## Solução escolhida

Limitar cada coluna do Kanban a **5 tarefas visíveis** e mostrar um botão **"+X"** com as demais. Ao clicar no botão, abrir uma **modal** com a lista completa daquela etapa.

## Mudanças

1. **Limite de 5 tarefas por coluna**
   - A `KanbanColumn` mostra apenas os 5 primeiros itens da lista.
   - Abaixo dos cards, exibe o contador total: "+3", "+8" etc.
   - O botão de "+X" usa o estilo secundário do sistema para não competir com os cards.

2. **Modal com a lista completa da etapa**
   - Ao clicar em "+X", abre uma `Dialog` com o título da etapa (ex: "Produção — 12 demandas").
   - O corpo da modal é rolável independentemente (`overflow-y-auto`) e o cabeçalho/rodapé ficam fixos.
   - Largura responsiva: `w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[85vh]`.
   - Dentro da modal, as demandas são exibidas como cards verticais com as mesmas informações do Kanban (título, cliente, tipo de mídia, prioridade, prazo, responsáveis).
   - Cada card da modal é clicável para abrir o detalhe da demanda.

3. **Ações mantidas**
   - O botão de mover etapa no card ainda funciona nos 5 cards visíveis.
   - A modal permite visualização e abertura do detalhe, mas não terá drag-and-drop (para evitar complexidade desnecessária; se for preciso mover, o usuário pode abrir o detalhe ou usar os cards visíveis).

4. **Estado local por coluna**
   - Novo estado `expandedColumn: string | null` em `KanbanView` para controlar qual coluna está com a modal aberta.
   - Ao trocar de aba (Kanban ↔ Lista), aplicar filtro ou alterar dados, o estado é resetado.

## Arquivo alterado

- `src/routes/_app/projects.tsx`

## Detalhes técnicos

- `KanbanColumn` recebe uma prop adicional `overflowCount` e `onExpand`.
- A lista mostrada na modal é passada por `items` completo, sem o corte dos 5 primeiros.
- Estilização do `DialogContent` segue o mesmo padrão responsivo usado no modal de tarefas do calendário (`max-h-[85vh]`, `flex flex-col`, corpo com `overflow-y-auto`).
