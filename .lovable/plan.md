
## Contexto

O relatório em `src/routes/_app/squad.relatorio.tsx` hoje usa a estrutura antiga baseada em `client_teams` (times amarrados a 1 cliente) e `client_team_members`. A nova estrutura já existente no banco é:

- `teams` (id, name) — times standalone da agência
- `team_members` (team_id, user_id) — vínculo com usuários
- `projects.team_id` — demanda pertence diretamente a um time

Observação importante sobre a instrução do pedido: a coluna `clients.team_id` **não existe** (verificado no schema). O vínculo time↔demanda é direto por `projects.team_id`, sem passar por `clients`. Vou seguir esse caminho, que é o correto e cobre a intenção da instrução ("demandas do time").

`src/lib/team.functions.ts` só contém utilitários de admin (delete/ban de usuários) — não tem nada relacionado ao relatório. Não precisa ser alterado.

## Mudanças em `src/routes/_app/squad.relatorio.tsx`

1. **Fetch dos times e membros**
   - `teamsQ`: `supabase.from("teams").select("id, name").order("name")`.
   - `membershipsQ`: `supabase.from("team_members").select("team_id, user_id, profiles:internal_profiles(id, full_name, avatar_url)")` para já trazer nome/avatar em um join. Se a FK não estiver definida para o join implícito, cai para dois queries e monta o Map em memória.
   - Remove `clientsQ` como dependência do agrupamento por time (mantém só para exibir nome do cliente em atividades).

2. **Projetos do time**
   - `projectsQ` passa a selecionar também `team_id`: `select("id, title, client_id, team_id")`.
   - Novo `teamProjectIds` = `projects.filter(p => p.team_id === teamFilter).map(p => p.id)` quando há filtro de time.
   - `byTeam` agrupa `time_logs` pelo `team_id` da demanda (via `projectMap.get(l.project_id).team_id`), com bucket `"__none"` para logs de projetos sem time.

3. **Roster (aba "Times")**
   - Para cada time, lista membros via `team_members` (nome + avatar + role_hint quando existir) e projetos ativos via `projects.team_id`, em vez de clientes.
   - Substitui as células "Clientes" por "Projetos" (ou mostra ambos: nº de projetos e clientes distintos derivados de `projects.client_id`).

4. **Filtros derivados**
   - `teamUserIds` continua vindo de `team_members` filtrado pelo `teamFilter`.
   - `teamMembersOptions` idem, agora com `full_name` do join.
   - Filtros dos queries de logs/transitions/comments/attachments seguem usando `teamUserIds` e `teamProjectIds` — só muda a fonte deles.

5. **Fallbacks / empty states**
   - Bloco de onboarding já existe (`showOnboarding`). Vou reforçar:
     - Card "Sem times cadastrados" com CTA para `/squad` quando `teams.length === 0`.
     - Card "Time sem membros" quando um `teamFilter` está selecionado e `teamUserIds.length === 0`.
     - Card "Time sem demandas" quando `teamProjectIds.length === 0`.
     - Mensagem "Sem sessões / atividades no período" nas tabelas quando arrays finais estão vazios, em vez de tabela vazia.
   - Todo `.map`/`.filter` sobre `teams`, `memberships`, `projects` fica protegido por `?? []`.

6. **Limpeza**
   - Remove `teamClientId` e `clientToDefaultTeam` (não fazem mais sentido).
   - Ajusta `queryKey`s (`rel_teams`, `rel_team_members`) e a lista `queryErrors`.
   - Mantém `internal_profiles` como fonte de nomes (já estava correto).

## Fora de escopo

- `src/lib/team.functions.ts`: sem alteração.
- Outras telas que ainda usam `client_teams` (ex.: `/clientes`) permanecem como estão — este refactor é isolado ao relatório.
