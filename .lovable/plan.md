# Filtros no Calendário (gerentes e administradores)

Adicionar uma barra de filtros na página `/calendario`, visível apenas para quem é gerente ou administrador. Usuários comuns continuam vendo somente as demandas em que estão marcados, sem a barra.

## Filtros

- **Responsável (colaborador)** — mostra apenas demandas onde a pessoa é responsável (campo principal ou lista de responsáveis).
- **Equipe/Squad** — demandas da equipe selecionada.
- **Cliente** — demandas do cliente selecionado.
- **Fase** — status do workflow.
- **Prioridade** — nível de prioridade.

Comportamento:
- Todos começam em "Todos"; combinam entre si (E lógico).
- Botão "Limpar filtros" aparece quando há algum filtro ativo, com contador de demandas exibidas.
- Filtros ficam na URL, então o link pode ser compartilhado e sobrevive ao recarregar.
- Funcionam nas visões Mês e Semana, nas abas Prazos e Postagens, e o arrastar-e-soltar continua igual.

## Detalhes técnicos

Arquivo: `src/routes/_app/calendario.tsx`.

- `validateSearch` com `zodValidator` + `fallback` para `resp`, `equipe`, `cliente`, `fase`, `prioridade` (strings, default `""`), lidos com `Route.useSearch()` e atualizados via `useNavigate` (forma funcional, preservando os demais).
- Novas queries: `profiles` (id, full_name) restrita a usuários internos, `teams` (id, name); reutiliza as queries já existentes de `clients`, `workflow_statuses` e `priorities`.
- A query existente de `project_assignees` passa a alimentar também o filtro de responsável (projeto tem a pessoa em `assigned_to` ou em `project_assignees`).
- Filtragem aplicada em um `useMemo` entre `projects` (já filtrado por visibilidade) e `eventsByDate`, mantendo a ordenação por prioridade.
- Barra renderizada apenas quando `isManager` (do `useAuth`) é verdadeiro, usando `Select` do shadcn; layout responsivo em grid que quebra no mobile.
