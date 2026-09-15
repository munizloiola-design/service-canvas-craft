# Verificação: outros campos com o mesmo limite de 1.000 registros

## O que eu conferi

Contei os registros de todas as tabelas grandes e revisei as telas que leem listas completas:

| Tabela | Registros | Situação |
|---|---|---|
| Responsáveis das demandas | 1.038 | já corrigido (paginado) |
| Tipos de mídia das demandas | 454 | **em risco** — sem paginação |
| Demandas | 450 | **em risco** — sem paginação |
| Movimentações de etapa | 251 | em risco a médio prazo |
| Material do cliente (entregáveis) | 194 | ok por ora |
| Permissões por especialidade | 148 | ok |
| Comentários / anexos / times / especialidades | < 100 | ok |
| Lançamentos financeiros / registros de tempo | 0 | ok |

Ou seja: **hoje só os responsáveis passaram do limite**, mas Demandas e Tipos de mídia estão na metade do caminho e vão apresentar o mesmo sintoma (itens novos sumindo da tela) dentro de alguns meses — Tipos de mídia é o mais perigoso, porque uma demanda com várias mídias gera várias linhas.

## O que será feito

Aplicar a mesma leitura em páginas (a que já resolveu os responsáveis) nas listas que hoje leem tudo de uma vez:

1. **Demandas** — listagem do Kanban, da Lista e do Calendário.
2. **Tipos de mídia das demandas** — mapa usado nos cards e filtros.
3. **Movimentações de etapa** e **material do cliente** nas telas que leem a tabela inteira (Dashboard, Relatório do Squad).

Nada muda visualmente nem nas permissões; é só garantir que nenhuma tela pare de mostrar registros novos quando o volume crescer.

## Detalhes técnicos

- Reutilizar `fetchAllRows` de `src/lib/fetch-all.ts` (paginação via `.range()`).
- `src/lib/project-media-types.ts`: trocar o `select` direto por `fetchAllRows("project_media_types", "project_id, media_type_id")`.
- `src/routes/_app/projects.tsx:185`, `src/routes/_app/calendario.tsx:123`, `src/routes/_app/dashboard.tsx:440/866/953/1014`: listas completas de `projects` passam por `fetchAllRows` (mantendo a ordenação no cliente onde já existe `order("created_at")`).
- `src/routes/_app/dashboard.tsx:388/899` e `src/routes/_app/squad.relatorio.tsx:179/198`: `project_transitions` / `project_comments` — paginar ou manter filtro de período explícito.
- Queries já filtradas por `eq("project_id", ...)` ou com `limit()` explícito ficam como estão.
