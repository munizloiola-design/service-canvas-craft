
## Contexto e diagnóstico atual

Fiz uma auditoria rápida do que mexemos por último e do que cada uma das três telas realmente executa. Até este momento **não há uma causa raiz confirmada** — não vi no console/rede a mensagem exata que aparece quando cada erro acontece. As últimas alterações estruturais foram:

- RLS em `user_roles` restringida a "próprio usuário ou gerente" (via `is_manager`, que é `SECURITY DEFINER` e ignora RLS internamente).
- RLS em `project_transitions` exigindo manager/assignee.

Nenhuma delas afeta as três funcionalidades reclamadas (schema e políticas conferidas: `clients` aceita insert de manager, `provider_areas/specialties/area_menu_visibility/specialty_field_visibility` idem, a view `time_logs_with_duration` existe). Portanto, sem o texto do erro real, qualquer correção seria chute.

O próprio pedido já autoriza o plano B: **instrumentar as três funções com `try/catch` + `console.error` + `toast.error` mostrando a mensagem real do Supabase (message, code, details, hint)**, publicar, reproduzir, ler o erro e aí sim consertar a causa.

## O que vou fazer

### 1. Cadastro de Cliente — `src/routes/_app/clientes-area.tsx`
- Envolver a mutation `save` (insert/update em `clients`) em `try/catch`.
- No `onError`, exibir `toast.error` com `error.message` + `error.details` + `error.hint` + `error.code` (quando existirem, formato PostgREST).
- Fazer o mesmo no `remove` (delete em `clients`).
- Logar objeto completo com `console.error("[clients:insert]", error, payload)` para termos payload no console.

### 2. Relatório dos Times — `src/routes/_app/squad.relatorio.tsx`
- Adicionar tratamento de erro em cada `useQuery` (`teams`, `profiles`, `team_members`, `clients`, `projects`, `time_logs_with_duration`) exibindo `toast.error` com a origem (`"Falha em <tabela>: <mensagem>"`) e `console.error` detalhado.
- Renderizar um bloco de erro visível no topo do relatório quando qualquer uma dessas queries estiver em estado `error`, listando qual query falhou e a mensagem — hoje o relatório mostra "Carregando…" mesmo quando o `fetch` falha, escondendo o problema.

### 3. Perfis de Acesso — `src/routes/_app/acessos.tsx`
- Reforçar `onError` de todas as mutations do `HierarchyTab` e do `AssignTab` (`createArea`, `deleteArea`, `createSpec`, `deleteSpec`, `rename`, `MenuVisibilityDialog.toggle`, `FieldVisibilityDialog.upsert`, `AssignTab.toggle`) para mostrar `toast.error` com `message` + `code` + `details` + `hint`.
- Adicionar `console.error("[acessos:<ação>]", error, variables)` para termos o payload que falhou.
- Se alguma `useQuery` da tela falhar (áreas/especialidades/perfis/`user_specialties`), exibir um `toast.error` uma única vez em vez de mostrar lista vazia silenciosa.

### Helper compartilhado
Vou criar `src/lib/supabase-error.ts` exportando `describeSupabaseError(error)` que formata `{ message, code, details, hint }` num texto único, para não repetir a mesma lógica de formatação nas três telas.

## Depois da instrumentação

Assim que você reproduzir cada um dos três erros com a nova build, o `toast` (e o console) vão mostrar exatamente:
- se é RLS (`code 42501` / "new row violates row-level security policy for table X"),
- coluna obrigatória faltando (`code 23502` / "null value in column ..."),
- FK inválida (`code 23503`),
- tabela/coluna inexistente (`PGRST204` / `42703`),
- ou outra coisa.

Com essa mensagem em mãos volto e faço o fix cirúrgico (ajuste de política, coluna nova, payload etc.) — sem alterar RLS no escuro.

## Detalhes técnicos

- Nada de mudanças de schema/RLS nesta rodada; só código de UI e um helper.
- Não vou trocar `useMutation` por chamadas cruas — mantenho a integração com TanStack Query intacta.
- As `useQuery` continuam com `queryFn` que dá `throw` no erro (o React Query já expõe `error`), então só preciso reagir a esse estado na UI e disparar `toast.error` uma vez via `useEffect` observando `query.error`.
- Toasts usam o `sonner` já configurado no projeto.

## Arquivos afetados

- `src/lib/supabase-error.ts` (novo)
- `src/routes/_app/clientes-area.tsx`
- `src/routes/_app/squad.relatorio.tsx`
- `src/routes/_app/acessos.tsx`
