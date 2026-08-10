# Ordenação por prioridade e ordenação por coluna na lista

## O que muda

**Kanban (Demandas)**
- Dentro de cada coluna, os cards passam a ficar ordenados da prioridade mais alta para a mais baixa (usando o nível cadastrado em Prioridades).
- Empate de prioridade: quem tem prazo mais próximo aparece primeiro; sem prazo vai para o fim.

**Calendário (Prazo e Postagem)**
- Dentro de cada dia, as demandas aparecem em ordem de prioridade (mais urgente no topo). Isso vale também na visão semana e na lista expandida do dia ("+X").
- Hoje o calendário nem carrega a prioridade da demanda; ela passa a ser carregada e usada na ordenação (e mostrada como um ponto colorido no card, opcional).

**Lista (Demandas → visão Lista)**
- Sim, dá para ordenar por qualquer coluna. Os cabeçalhos da tabela viram clicáveis: 1º clique ordena crescente, 2º decrescente, 3º volta ao padrão.
- Colunas ordenáveis: Título, Cliente, Tipo de mídia, Etapa (ordem do fluxo), Prioridade (nível), Responsáveis, Prazo e Postagem.
- Uma seta indica a coluna e o sentido ativos. Ordenação padrão da lista: prioridade (maior primeiro), depois prazo.
- Datas vazias sempre no fim, independentemente do sentido.

## Detalhes técnicos

- `src/routes/_app/projects.tsx`
  - Novo helper de comparação usando `priorities` (campo `level`, maior = mais urgente) e mapa `maps.priority`.
  - `KanbanColumn`: ordenar `items` antes de fatiar em `visibleItems`/overflow, para que o corte de 5 respeite a prioridade.
  - `ListView`: estado local `{ key, dir }`; `useMemo` aplicando comparador por tipo (texto com `localeCompare`, data ISO por string, etapa por `sort_order`, prioridade por `level`); cabeçalhos `<th>` como botões com ícone de direção.
- `src/routes/_app/calendario.tsx`
  - Incluir `priority_id` no `select` de `projects` e buscar a tabela `priorities` (id, level, color).
  - Ordenar cada bucket de `eventsByDate` por nível de prioridade desc, depois por título.

Sem alterações de banco de dados.
