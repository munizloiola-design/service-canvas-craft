# Demandas e Calendário: ver apenas as demandas do usuário

## O que muda

Nas telas **Demandas** (`/projects`) e **Calendário** (`/calendario`), cada usuário passa a ver somente as demandas em que ele está marcado como responsável.

- Conta como "marcado": estar na lista de **Responsáveis** da demanda ou ser o responsável principal.
- **Administradores e Gerentes** continuam vendo todas as demandas, sem alteração.
- Equipe responsável não conta: estar na equipe, sem estar marcado individualmente, não libera a demanda.
- Vale para todas as visões: Kanban, Lista, Mês e Semana, além dos filtros e contadores dessas telas.

## Detalhes técnicos

- `src/routes/_app/projects.tsx`: após carregar `projects` e `project_assignees`, aplicar um filtro de visibilidade antes de qualquer outro filtro/derivação — se `isManager` (do `useAuth`) for falso, manter apenas projetos em que `assigned_to === user.id` ou que tenham um registro em `project_assignees` com `user_id === user.id`. As derivações existentes (Kanban, Lista, filtros, colunas) passam a consumir essa lista já filtrada.
- `src/routes/_app/calendario.tsx`: a página hoje consulta apenas `projects`. Adicionar uma query para `project_assignees` (só `project_id, user_id`) e aplicar o mesmo filtro antes de montar `eventsByDate`, com a mesma exceção para gerentes/admins.
- Nenhuma mudança de banco ou RLS: é um recorte de visualização nas duas telas. O portal do cliente e demais telas permanecem como estão.
