# Dashboard: aplicar as regras de fase do membro filtrado

## O problema

As marcações de "Início" e "Concluído" por especialidade já existem (ex.: Designer → Revisão conta como concluído). Mas no Dashboard elas só valem para a própria pessoa logada. Como administrador, o sistema ignora essas regras e usa apenas a marcação global de "etapa final" — por isso, mesmo filtrando por um membro, tudo de "Revisão" em diante continua entrando em "Atrasados" e "Em aberto".

## Como vai ficar

Quando o administrador/gerente filtrar o Dashboard por um membro da equipe, os indicadores passam a usar as regras de fase das especialidades **daquele membro**:

- "Concluídos" conta as fases que a especialidade dele considera entregues (ex.: Revisão para o Designer).
- "Em aberto", "Urgentes" e "Atrasados" deixam de contar essas demandas.
- O widget "Demandas atrasadas" e o card "Minhas demandas por fase" seguem a mesma regra.
- Demandas em fases anteriores à fase de "Início" do membro não entram na contagem dele.

Com o filtro em "Todos", nada muda: continua valendo a marcação global de etapa final.

## Detalhes técnicos

- `src/lib/access-sections.ts`: extrair a lógica de `useStageRules` para uma função pura `buildStageRules({ startStageOrder, doneStatusIds, statusOrder, finalStatusIds })` e adicionar `useStageRulesFor(userId | null)`, que busca `user_specialties` + `specialty_stage_rules` do usuário informado (React Query, cache por id) e devolve `{ isStarted, isDone }`; sem `userId` ou sem regras, cai no comportamento atual (`finalStatusIds`).
- `src/routes/_app/dashboard.tsx`: nos componentes que hoje chamam `useStageRules()` (`StatsOverview`, `OverdueProjects`, o widget por membro e o de fases), trocar por `useStageRulesFor(scopeUserId)`, usando o `scopeUserId` já disponível via `useScopeUserId()`.
- Sem mudanças de banco.
