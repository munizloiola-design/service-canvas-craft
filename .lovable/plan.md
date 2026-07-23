# Migração de `clients.team_id` → `client_teams`

Hoje `clients.team_id` aponta para a tabela antiga `teams`. A nova estrutura (`client_teams` + `client_team_members`) já existe mas está vazia (0 linhas) e coexiste com a antiga, causando duas fontes de verdade. Vamos consolidar tudo em `client_teams` sem quebrar o front-end.

## Estado atual verificado

- 1 cliente com `team_id` preenchido (Digital Comunicação → "Novo time 23/07/2026, 19:57", 1 membro em `team_members`).
- `client_teams`: 0 linhas. `client_team_members`: 0 linhas.
- Código que ainda lê `clients.team_id`:
  - `src/routes/_app/clientes.tsx` (edição do cliente, seleção de time)
  - `src/routes/_app/projects.tsx` (auto-preenchimento de assignees a partir do time do cliente)
  - `src/routes/_app/squad.relatorio.tsx` (filtro por time)

## Etapa 1 — Migração SQL (uma migration)

1. Backfill: para cada `clients.team_id NOT NULL`, criar uma linha em `client_teams` com `client_id = c.id`, `name = teams.name`, `is_default = true`.
2. Copiar `team_members` correspondentes para `client_team_members` (mapeando via `teams.id`), com `role_hint = NULL`.
3. Remover FK `clients_team_id_fkey` e a coluna `clients.team_id` (a coluna paralela `projects.team_id` continua existindo e não é tocada nesta etapa).

Nenhum GRANT/RLS novo é necessário — `client_teams` e `client_team_members` já têm políticas.

## Etapa 2 — Ajustes no front-end

- `clientes.tsx`: remover o `<Select>` de time e o campo `team_id` do formulário/lista. A coluna "Time" da tabela passa a mostrar o time default de `client_teams` (ou "—"). Gestão de times continua em Squad → Times de Cliente.
- `projects.tsx`: substituir a query `client_team_id` por uma que lê `client_teams` (default do cliente) e `client_team_members` para popular assignees. Passar `team_id: null` no insert (ou remover, mantendo compatibilidade).
- `squad.relatorio.tsx`: trocar `clients.team_id` + `team_members` por `client_teams` + `client_team_members`. O filtro "Time" continua funcionando, agora sobre times de cliente.

## Etapa 3 — Regenerar tipos

Após a migration aprovada, `src/integrations/supabase/types.ts` é regenerado automaticamente; os ajustes de código na Etapa 2 usam o schema novo.

## Fora do escopo

- Remoção da tabela legada `teams` / `team_members` (ainda usada por `projects.team_id` e outras telas de Squad). Fica para uma migração futura, se desejado.
