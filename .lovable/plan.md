# Calendário deve herdar as fases autorizadas do Kanban

## Diagnóstico (confirmado no código)

O seletor de etapa do modal do calendário já filtra por `useCalendarStageGate()`. O problema está no fallback de `canViewSection` em `src/lib/access-context.tsx`: quando a especialidade **não tem nenhuma regra cadastrada para o menu Calendário**, tudo fica liberado (`!hasRulesFor(menu)` retorna true). Como as regras de fase costumam estar cadastradas só em **Demandas** (`/projects`), o calendário ignora essas restrições e mostra todas as etapas.

## Como vai funcionar

- Se a especialidade **tem regras de fase para o Calendário**, vale o que está marcado lá (comportamento atual).
- Se **não tem regra para o Calendário**, o calendário herda as fases autorizadas em **Demandas (Kanban)** — tanto no seletor de etapa do modal quanto nos eventos exibidos na grade e no filtro "Etapa".
- Sem nenhuma regra nos dois menus, tudo continua visível (padrão atual).

## Detalhes técnicos

- `src/lib/access-context.tsx`: expor `hasSectionRules(menu)` no contexto (a função `hasRulesFor` já existe internamente).
- `src/lib/access-sections.ts`: em `useCalendarStageGate()`, verificar `hasSectionRules("/calendario")`; se houver regras, usar `canViewSection("/calendario", ...)`, senão usar `canViewSection("/projects", ...)` (mesma chave `stage:<id>`).
- Nenhuma mudança em banco, RLS ou telas de permissão.
