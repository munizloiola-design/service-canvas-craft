# Estender a permissão de fases também para a Lista

Hoje o filtro por fase (configurado em Perfis e Acessos → Especialidade) só vale para o Kanban. Na visão Lista as demandas de fases bloqueadas continuam aparecendo.

## Como vai funcionar

- A mesma regra de fase passa a valer nas duas visões: se a especialidade não pode ver a fase X, as demandas nessa fase não aparecem nem no Kanban nem na Lista.
- O filtro "Etapa" (na barra de filtros) já lista apenas fases liberadas — continua assim.
- O comportamento padrão não muda: sem nenhuma regra cadastrada para Demandas, tudo continua visível.
- Abrir o detalhe de uma demanda em fase bloqueada deixa de ser possível pela Lista, já que ela não é exibida.

## Detalhes técnicos

- `src/routes/_app/projects.tsx`: renomear `kanbanProjects` para `stageVisibleProjects` (mesma lógica: `!p.status_id || allowedStatusIds.has(p.status_id)`) e usar essa lista tanto no `KanbanView` quanto no `ListView`.
- Sem mudança de banco, de RLS ou de UI de permissões — a chave `menu:/projects#stage:<status_id>` já existe.
