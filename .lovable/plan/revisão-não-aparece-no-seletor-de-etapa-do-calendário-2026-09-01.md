# Revisão não aparece no seletor de etapa do Calendário

## Por que acontece

A especialidade **Designer** tem regras de fase cadastradas para o menu Calendário com apenas 3 etapas liberadas: Aguardando Produção, Produção e Correção. No Kanban (Demandas), o Designer também enxerga **Revisão**. Como o modal do Calendário usa a mesma lista de fases da grade (regras do Calendário), Revisão fica de fora do seletor.

## O que muda

- **Grade do calendário e filtro "Etapa"**: continuam mostrando apenas o que está liberado no Calendário (hoje: Aguardando Produção, Produção, Correção para o Designer).
- **Seletor de etapa dentro do modal da demanda**: passa a listar as fases liberadas no **Kanban** (Demandas). Assim o Designer consegue mover a demanda para Revisão, mesmo que Revisão não apareça na grade do Calendário.
- A etapa atual da demanda sempre aparece no seletor, mesmo que não esteja liberada em nenhum dos dois menus (evita seletor vazio ou valor inválido).
- Comportamentos existentes seguem iguais: permissão de edição do campo Etapa, pergunta de prazo ao entrar em Correção e prioridade Alta automática.

## Detalhes técnicos

Arquivo: `src/routes/_app/calendario.tsx`.

- Manter `useCalendarStageGate()` para o filtro de demandas visíveis e para as opções do filtro "Etapa".
- Adicionar `useStageGate()` (regras de `/projects`) e criar uma lista separada `modalStageOptions = statuses.filter(s => canSeeKanbanStage(s.id) || s.id === detail?.status_id)` usada só no `Select` do modal.
- Sem mudanças em banco, RLS ou em Perfis e Acessos.
