## Objetivo

No formulário de demanda (Nova/Editar demanda), ao selecionar uma **Equipe responsável**, os membros dessa equipe devem aparecer automaticamente na lista de **Responsáveis**.

## Situação atual

Hoje o auto-preenchimento de Responsáveis só acontece quando se escolhe o **Cliente** (usa o time padrão do cliente em `client_teams` / `client_team_members`). O campo **Equipe responsável** (tabela `teams`) apenas grava `projects.team_id` — não mexe nos Responsáveis.

## O que será feito

Em `src/routes/_app/projects.tsx` (componente do formulário de demanda):

1. Buscar os membros da equipe selecionada em `team_members` (por `team_id`), com a query habilitada apenas quando houver uma equipe escolhida.
2. Ao mudar a equipe selecionada (e somente quando muda, para não sobrescrever edições manuais), acrescentar os membros da equipe à lista de Responsáveis:
   - mantém as pessoas já escolhidas manualmente;
   - adiciona apenas quem ainda não está na lista (sem duplicar);
   - deixa o campo "Função" vazio para os adicionados, editável normalmente;
   - o usuário continua podendo remover qualquer pessoa com o botão X.
3. Ao abrir uma demanda existente para edição, não haverá re-preenchimento automático — só quando a equipe for efetivamente trocada.
4. Exibir uma nota curta abaixo do campo, no mesmo estilo da já existente para o cliente: "Membros da equipe X aplicados automaticamente — você pode adicionar ou remover pessoas."

## Detalhes técnicos

- Nova `useQuery` `["team_members_for_team", teamId]` lendo `team_members(user_id)` filtrado por `team_id`.
- Novo estado `lastAutoFilledTeam` espelhando a lógica de `lastAutoFilledClient`, com `useEffect` disparado por `teamId` + lista de membros carregada.
- Nenhuma alteração de banco de dados, RLS ou lógica de salvamento: os responsáveis continuam sendo gravados em `project_assignees` como hoje.
