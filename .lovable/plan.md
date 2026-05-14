# Fase 2 — Workflow, permissões, calendários e dashboard

## 1. Status configurável nas demandas

Já existe a tabela `workflow_statuses` (name, color, sort_order, is_final, is_review, is_client_validation). Vou:

- Criar página **Cadastros → Status** para CRUD (gerentes/admin) com drag-to-reorder.
- Em `projects.tsx`, trocar o seletor fixo de status pela lista dinâmica de `workflow_statuses` (já há `status_id`, mas o código ainda usa o enum `status`). Manter compatibilidade lendo `status_id` quando presente.
- Toda mudança de status grava em `project_transitions` (já existe).

## 2. Permissões granulares por área

Hoje só existem 3 papéis (`admin`, `gerente`, `membro`) via `user_roles`. Para permissões finas sem reescrever tudo:

- Nova tabela `role_permissions(role app_role, resource text, action text)` — ex.: `('membro','financeiro','view')`.
- Função `has_permission(_uid, _resource, _action)` security definer.
- Tela **Cadastros → Permissões**: matriz papel × recurso (financeiro, orçamento, equipamentos, equipe, cadastros, projetos) × ações (view, create, edit, delete).
- No frontend, hook `usePermission(resource, action)` esconde itens do menu e botões.
- RLS continua usando `is_manager` para escrita; a granularidade extra fica no app layer (suficiente para UI; o backstop RLS continua).

## 3. Calendários

Nova rota `/calendario` com duas abas:

- **Prazo**: eventos = `projects.due_date`.
- **Postagem**: eventos = `projects.post_date`.

Componente baseado em `react-big-calendar` (mês/semana/dia), cores por status, clique abre o projeto.

## 4. Filtros avançados em Projetos

Em `/projects`, adicionar barra de filtros combináveis (botão "+ Adicionar filtro"):
cliente, responsável, status, prioridade, tipo de mídia, decisão do cliente, intervalo de datas (prazo/postagem). Estado salvo na URL (search params via TanStack Router) para compartilhar.

## 5. Cronômetro oculto de status

- Coluna `entered_at timestamptz` em `project_transitions` (já temos `created_at`, basta usar).
- View materializada não — fazemos query agregada: para cada projeto, somar `(próximo created_at - created_at)` por `from_status_id` ⇒ tempo médio em cada status.
- Novo endpoint via `createServerFn` `getStatusDurations()` retorna `{ status_id, avg_seconds, count }`.
- Card no dashboard "Tempo médio por status".

## 6. Dashboard personalizável

- Nova tabela `dashboard_widgets(user_id, widget_key, position int, size text, config jsonb)`.
- Catálogo de widgets: Resumo financeiro, Cash flow 12m, Projetos por status, Tempo médio por status, Próximos prazos, Receitas recorrentes, Carga por profissional, Margem média (orçamentos), Equipamentos depreciados.
- Modo "editar dashboard": adicionar/remover/reordenar (drag) widgets, salvar por usuário.
- Default: 4 widgets pré-configurados para novos usuários.

## Detalhes técnicos

- Migração única: `role_permissions` + seed default + função `has_permission` + (se necessário) índice em `project_transitions(project_id, created_at)`.
- Dependências novas: `react-big-calendar`, `@dnd-kit/core` + `@dnd-kit/sortable` (drag de status e widgets).
- Server functions em `src/lib/`: `permissions.functions.ts`, `analytics.functions.ts` (durações, agregados do dashboard).
- Hooks: `usePermission`, `useDashboardLayout`.
- Sidebar ganha entrada **Calendário**; **Cadastros** ganha sub-itens Status e Permissões.

## Ordem de execução

1. Migração (permissões + helpers).
2. Status dinâmicos + tela de cadastro.
3. Permissões + matriz + hook.
4. Filtros em projetos + URL state.
5. Calendário.
6. Cronômetro de status (server fn + card).
7. Dashboard personalizável.

Posso começar pela etapa 1 ou prefere reordenar?
