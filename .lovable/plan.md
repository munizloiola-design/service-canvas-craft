# Indicadores de eficiência e ordenação das etapas

## 1. Indicadores gerais: Eficiência

Novo card "Eficiência" nos indicadores gerais, no mesmo padrão dos demais:

- Eficiência = demandas sem atraso ÷ total de demandas do período (percentual grande).
- Abaixo, o detalhe: "X de Y no prazo".
- O atraso continua respeitando as regras já existentes por perfil (data de referência prazo ou postagem, e o que cada especialidade considera concluído), incluindo o que atrasou e já foi resolvido.
- Sem demandas no período, mostra "—".
- Cor: verde acima de 85%, âmbar entre 60% e 85%, vermelho abaixo.
- Ao clicar, abre a modal de detalhamento já usada pelos outros indicadores, listando as demandas que atrasaram.

## 2. Indicadores gerais: Correção

Novo card "Correção", de acesso rápido às demandas que voltaram de fase:

- Conta as demandas que retornaram a uma etapa anterior no histórico ou foram reprovadas pelo cliente (uma vez por demanda).
- Clicando, abre a mesma modal com a lista dessas demandas.

## 3. Cadastros: arrastar a ordem das etapas do fluxo

Na aba "Etapas do fluxo" (Cadastros):

- As etapas passam a ser reordenáveis arrastando com o mouse; ao soltar, a nova ordem é gravada.
- Um botão de cadeado no topo da lista bloqueia/desbloqueia o arraste. Começa bloqueado, para evitar mudanças acidentais; o estado fica lembrado no navegador.
- Com o cadeado fechado, a lista funciona como hoje (só editar e remover).

## Detalhes técnicos

- `src/routes/_app/dashboard.tsx`: em `StatsOverview`, dois novos itens em `stats`. Eficiência usa `lateness.lateIds` (aberto + resolvido) sobre `projects.length`, com `display` percentual e `valueClass` por faixa; Correção usa `regressedIds` ∪ `client_decision === "reprovado"`, já disponíveis em `useLateness`. `secondaryMeta` ganha as cores dos dois novos rótulos.
- Cálculo puro reaproveitado de `src/lib/dashboard-efficiency.ts` (`computeLateness`, `isReturned`); nenhum novo arquivo de lógica.
- `src/routes/_app/cadastros.tsx`: `CrudTable` recebe `reorderable` (ativo só para `workflow_statuses`), com `DndContext` + `SortableContext` (`@dnd-kit`, já instalado) e handle de arraste. Ao soltar, `update` de `sort_order` sequencial das linhas afetadas e invalidação da query. Cadeado via `usePersistedState("cadastros:lock-etapas", true)`.
- Sem mudanças de banco.
