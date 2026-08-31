# Ajuste do indicador "Correção" no Dashboard

## Objetivo

O card **Correção** dos Indicadores gerais deve contar apenas as demandas que estão **atualmente na fase de correção** do fluxo, e não o histórico de demandas que voltaram de fase ou foram reprovadas pelo cliente.

## Estado atual (verificado)

- Em `src/routes/_app/dashboard.tsx`, o card "Correção" usa o conjunto `correctionIds` montado assim:
  - demandas com transição regressiva no histórico (`regressedIds`), **ou**
  - demandas com `client_decision === "reprovado"`
- A fase "Correção" existe em `workflow_statuses` (nome exato: `Correção`, `sort_order: 6`).

## Mudanças

1. Em `src/routes/_app/dashboard.tsx`, dentro de `StatsOverview`:
   - Localizar o `status_id` da etapa cujo nome seja "Correção".
   - Recalcular `correctionIds` como o conjunto de projetos cujo `status_id` seja igual a esse `status_id`.
   - Atualizar o subtítulo do card para refletir o novo critério (ex.: "Na fase de correção").
   - Manter o comportamento de clique: abre a modal listando as demandas que estão nessa fase.

2. Nenhuma mudança de banco é necessária.
