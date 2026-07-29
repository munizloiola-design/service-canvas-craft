## Diagnóstico

A busca dos membros da equipe está funcionando — a requisição a `team_members` para a equipe "ROXO" retornou 2 usuários (confirmado nos registros de rede).

O problema está na ordem de execução: ao selecionar a equipe, o efeito de preenchimento roda **antes** de os membros chegarem do servidor. Com a lista ainda vazia, o código marca a equipe como "já preenchida" (`lastAutoFilledTeam = teamId`) e sai. Quando os membros finalmente chegam, o efeito roda de novo, vê que a equipe já foi "preenchida" e não faz nada — por isso Responsáveis fica vazio.

## Correção

Em `src/routes/_app/projects.tsx` (formulário de demanda):

1. Passar a usar também o estado de carregamento da consulta de membros da equipe (`isFetching`/`isSuccess` do `useQuery`).
2. Só marcar a equipe como preenchida depois que a consulta terminar de carregar:
   - enquanto estiver carregando, o efeito não faz nada e não marca nada;
   - quando os dados chegarem, adiciona os membros aos Responsáveis (sem duplicar, preservando escolhas manuais) e só então grava `lastAutoFilledTeam`;
   - se a equipe realmente não tiver membros, marca como preenchida e não altera a lista.
3. Aplicar exatamente o mesmo ajuste ao preenchimento automático a partir do **Cliente** (time padrão do cliente), que tem a mesma condição de corrida.

Nenhuma mudança de banco de dados, permissões ou gravação: os responsáveis continuam salvos em `project_assignees` como hoje.
