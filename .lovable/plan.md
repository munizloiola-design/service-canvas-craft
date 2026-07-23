## 1. Calendário: visualização Mês/Semana + arrastar para reagendar

Arquivo: `src/routes/_app/calendario.tsx`

- Adicionar um segundo `Tabs` (ou um `ToggleGroup`) para modo de visão: **Mês** e **Semana** (padrão Mês). Mantém o Tabs atual "Prazos / Postagens" — os dois modos operam sobre `due_date` ou `post_date` conforme selecionado.
- **Visão Semana**: usar `startOfWeek`/`endOfWeek(cursor)` e navegação com `addWeaks`/`subWeeks`. Layout: 7 colunas altas (`min-h-[70vh]`) com título "DD/MM" em cada coluna e cards empilhados no dia. Título passa a mostrar "DD MMM – DD MMM yyyy".
- **Drag-and-drop nativo (HTML5)**, sem nova dependência:
  - Cada card recebe `draggable`, `onDragStart` guardando `p.id`.
  - Cada célula-dia recebe `onDragOver` (com `preventDefault` + destaque via classe) e `onDrop` que dispara mutação.
- **Mutação `rescheduleProject`** com `useMutation`:
  - Atualiza `projects.[dateField] = novoDia (YYYY-MM-DD)` via `supabase.from("projects").update(...).eq("id", id)`.
  - Optimistic update: patch de `["projects-cal"]` antes; rollback em erro; `invalidateQueries` no final.
  - Toast de sucesso "Reagendado para DD/MM" (sonner).
  - Se o valor não mudar, ignora.
- Respeita permissões existentes de update em `projects` (RLS). Se o usuário não tiver acesso, o erro do Supabase é mostrado via toast — sem gate adicional no cliente.
- Sem mudanças no banco. Não altera clique para abrir detalhe (apenas o drag mexe na data).

## 2. Times: busca no diálogo + confirmar edição/exclusão

Arquivo: `src/routes/_app/squad.tsx`

- Verificado: o seletor de membros já usa `profiles` (apenas usuários cadastrados) e a tela já tem botões de **editar** (lápis) e **excluir** (lixeira com `confirm()`). Nada muda aí.
- **Adicionar campo de busca** dentro de `TeamDialog` (acima da lista de membros):
  - `Input` com ícone `Search`, placeholder "Buscar membro…", `value` controlado por `useState("")`.
  - Filtra `profiles` por `full_name` (case/acento-insensível simples via `.toLowerCase().normalize`) antes do `.map`.
  - Mostra "Nenhum resultado" quando o filtro não bater; membros já selecionados que não passam no filtro continuam contando em `selected` (mantidos ao salvar).
- Sem alterações de schema.
