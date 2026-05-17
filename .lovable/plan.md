## Objetivo

Melhorar o kanban no mobile: colunas empilhadas verticalmente e arrastar/soltar cards entre etapas funcionando tanto no touch quanto no mouse.

(O pedido do Meta Business em iframe fica pulado — Meta bloqueia embed via header de segurança.)

## Mudanças

### 1. Layout responsivo do kanban
Arquivo: `src/routes/_app/projects.tsx` (componente `KanbanView`, ~linha 303)

- Substituir o `gridTemplateColumns` fixo por classes responsivas:
  - **Mobile (<768px)**: 1 coluna, etapas empilhadas verticalmente; cada coluna ocupa largura total e os cards ficam visíveis em sequência.
  - **Tablet (≥768px)**: 2 colunas.
  - **Desktop (≥1024px)**: layout horizontal atual (até 5 colunas lado a lado, com scroll horizontal se houver mais etapas).
- Ajustar altura mínima e padding para o empilhamento ficar legível.

### 2. Drag-and-drop com `@dnd-kit`
Biblioteca: `@dnd-kit/core` + `@dnd-kit/sortable` (suporte nativo a touch e mouse, leve, sem dependências de React DnD).

- Instalar via `bun add @dnd-kit/core @dnd-kit/sortable`.
- Envolver o `KanbanView` em `<DndContext>` configurado com `PointerSensor` + `TouchSensor` (ativação por pequeno delay para não conflitar com scroll/tap no mobile).
- Cada coluna vira um `useDroppable` (id = `status_id`).
- Cada card vira um `useDraggable` (id = `project_id`, dados = `{ from_status_id }`).
- No `onDragEnd`:
  - Se `over.id !== active.data.from_status_id`, disparar a mesma mutation `updateStatus` que já existe (atualiza `projects.status_id` + insere em `project_transitions`).
  - Atualização otimista local via `queryClient.setQueryData(["projects"], ...)` para o card "saltar" na hora.
- Manter o `<Select>` "Mover para..." dentro do card como fallback acessível (útil em telas onde drag é desconfortável).
- Indicação visual: coluna alvo fica com `ring-2 ring-primary` durante o hover; card arrastado fica `opacity-50`.

### 3. Considerações
- Colaborador só pode arrastar cards em que está atribuído (RLS já bloqueia update, mas o handler também valida `isManager || isAssignee` antes da mutation para evitar erro feio).
- Em etapas finais/validação de cliente, manter a regra atual (sem restrição extra agora).
- O detalhe do card (clique para abrir) continua funcionando — o `DndContext` usa delay/distância mínima para diferenciar tap de drag.

## Resumo dos arquivos tocados

- `package.json` — adicionar `@dnd-kit/core`, `@dnd-kit/sortable`.
- `src/routes/_app/projects.tsx` — refatorar `KanbanView` (layout responsivo + DnD).

Nenhuma mudança de banco, RLS ou outra tela.