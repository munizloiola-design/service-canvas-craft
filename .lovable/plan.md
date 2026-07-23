## 1. Melhorar Relatório de Squad (`/squad/relatorio`)

Página abre vazia porque não há times/membros/sessões cadastradas. Ajustes:

- Detectar quando **não há times cadastrados**, **não há membros de time** e **não há sessões no período** e mostrar estado vazio ilustrativo com CTAs:
  - "Criar time" → abre `/squad` (aba Times)
  - "Adicionar membros a um time" → `/squad` (aba Equipe)
  - "Registrar tempo" → `/tempo`
- Suprimir os gráficos e as tabelas de "Por time / Por membro" quando não houver dados, mantendo a aba "Composição" visível para orientar o próximo passo.
- Reaproveitar filtros existentes (De, Até, Time, Membro, Exportar CSV) — já estão funcionais.

## 2. Nova aba "Atividades" no Relatório de Squad

Adicionar aba **Atividades** consolidando timeline de eventos do time no período com filtros compartilhados (data, time, membro):

- **Sessões de tempo** (`time_logs_with_duration` + `projects` + `clients`)
- **Mudanças de status** (`project_transitions` → de/para status + ator)
- **Comentários** (`project_comments`)
- **Anexos** (`project_attachments`)
- **Tickets** (`ticket_requests` — abertura e resolução)

UI:
- KPIs adicionais: nº de eventos por tipo no período.
- Timeline cronológica (desc), com ícone por tipo, membro, projeto/cliente e link para o projeto.
- Sub-filtro por tipo de atividade (checkbox multi).
- Botão **Exportar CSV** da timeline.

## 3. Auditoria de botões sem ação (varredura completa)

Percorrer rotas em `src/routes/_app/*` e `src/routes/portal/*` procurando:

- `<Button>` sem `onClick`, `type="submit"` fora de `<form onSubmit>`, ou `href`/`asChild` ausentes.
- `DropdownMenuItem`, `MenuItem`, ícones clicáveis sem handler.
- Handlers que só fazem `console.log` / `TODO` / vazio.

Para cada botão morto: ou implementar a ação esperada pelo contexto, ou remover se for legado. Priorizar as áreas que sofreram mudanças recentes (Financeiro, Squad, Área do Cliente, Acessos, Calendário, Configurações).

Entregável: lista curta no fim da execução com botões corrigidos e justificativa.

## Detalhes técnicos

- Novos queries em `squad.relatorio.tsx` para transitions/comments/attachments/tickets, com `.in("project_id", ...)` limitado aos projetos dos clientes do time filtrado (via `clients.team_id`) para respeitar o filtro.
- Filtros continuam via `Route.useSearch()`; adicionar `types?: string` (csv) para o sub-filtro de tipos.
- Sem migração — todas as tabelas já existem e têm RLS que permite leitura por membros/gestores.
- Estados vazios usam componentes shadcn existentes (`Card` + `Button` + ícones lucide), sem novas libs.
