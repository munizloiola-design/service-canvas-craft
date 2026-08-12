# Lembrar os últimos filtros usados

Sim, dá para salvar. A ideia: o sistema guarda no próprio navegador o último estado de filtros/ordenação de cada tela e restaura quando você volta.

## O que fica salvo

**Demandas (`/projects`)**
- Visão escolhida (Kanban ou Lista)
- Filtros ativos (cliente, responsável, fase, prioridade etc.)
- Filtro rápido (atrasadas, urgentes, etc.)
- Ordenação da Lista (coluna + sentido)
- Colunas visíveis da Lista

**Calendário (`/calendario`)**
- Filtros de responsável, equipe, cliente, fase e prioridade
- Visão Mês/Semana e aba (Prazos/Postagens)

## Comportamento

- Salvo por usuário e por navegador (não sincroniza entre dispositivos).
- Se você abrir um link com filtros na URL (ex.: vindo do dashboard), a URL manda — e esse estado passa a ser o novo "último usado".
- Botão "Limpar filtros" também limpa o que estava salvo.

## Detalhes técnicos

- Novo hook `src/hooks/use-persisted-state.ts`: `useState` com leitura/escrita em `localStorage` sob chave `dw:<tela>:<campo>:<userId>`, com leitura só após hidratação (evita mismatch de SSR) e `try/catch` em JSON inválido.
- `src/routes/_app/projects.tsx`: trocar `useState` por versão persistida em `view`, `filters`, `quick`, `visibleCols` e no `sort` da `ListView`. `search.quick`/`search.detail` continuam tendo precedência quando presentes na URL.
- `src/routes/_app/calendario.tsx`: os filtros já vivem na URL; ao montar sem search params, restaurar do storage via `navigate({ search, replace: true })`; a cada mudança de search, gravar no storage. `view` e aba também persistidos.
- Sem alterações de banco de dados.
