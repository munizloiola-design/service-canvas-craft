## Objetivo
Criar um painel de análise de tempo alimentado pela view `public.time_logs_with_duration`, com gráficos e tabelas agregadas por projeto e por usuário, filtráveis por período.

## Acesso
- Somente Gerentes / Administradores (a view/RLS já limita o SELECT via `is_manager`/`is_master`).
- Novo recurso de permissão `time_reports` (view) adicionado ao tipo `Resource` em `src/lib/permissions.tsx` e ao seed via migração em `role_permissions` para `admin` e `gerente`.

## Navegação
- Adicionar item "Tempo" (ícone `Clock`) no grupo **Operação** de `src/routes/_app.tsx`, apontando para `/tempo`, visível apenas quando `can("time_reports","view")`.

## Rota
Novo arquivo `src/routes/_app/tempo.tsx` (`createFileRoute("/_app/tempo")`), com `head()` próprio ("Relatório de tempo").

Filtros no topo:
- Período (data início / data fim) — padrão: últimos 30 dias. Estado sincronizado na URL via `validateSearch` (`from`, `to`).
- Seletor de projeto (opcional) e de usuário (opcional).
- Botão "Exportar CSV" das linhas agregadas visíveis.

## Consulta de dados
- Um único `useQuery` server-side que lê `time_logs_with_duration` filtrando `started_at >= from` e `ended_at <= to` (ou `ended_at IS NOT NULL`), trazendo `project_id`, `user_id`, `status_id`, `duration_seconds`, `started_at`, `ended_at`.
- Consultas auxiliares em paralelo para nomes: `projects(id,title)`, `profiles(id,full_name)`, `workflow_statuses(id,name,color)`.
- Agregações feitas no cliente em `useMemo` (volume esperado modesto): totais por projeto, por usuário, por dia, por etapa.

## Layout do painel
1. **KPIs (4 cards)**: Horas totais no período, Nº de sessões, Projetos ativos, Colaboradores ativos.
2. **Gráfico de linha — Horas por dia** (Recharts `LineChart`) usando token `--chart-1`.
3. **Gráfico de barras — Top 10 projetos por horas** (`BarChart` horizontal), token `--chart-2`.
4. **Gráfico de barras — Horas por usuário** (`BarChart`), token `--chart-3`.
5. **Gráfico donut — Distribuição por etapa** (`PieChart`) usando cores das `workflow_statuses`.
6. **Tabela "Por projeto"**: Projeto · Sessões · Horas · Última atividade · Colaboradores distintos. Ordenável por horas.
7. **Tabela "Por usuário"**: Usuário · Sessões · Horas · Projetos distintos · Média por sessão. Ordenável por horas.
8. **Tabela detalhada (colapsável)**: uma linha por sessão (`started_at`, `ended_at`, projeto, usuário, etapa, duração).

Todas as tabelas respeitam os filtros do topo. Exportação CSV usa a agregação exibida (uma função utilitária local).

## Detalhes técnicos
- Formatação de duração: helper local `formatHours(seconds)` → `"12h 30m"` e `secondsToHours(seconds)` para valores numéricos nos gráficos.
- Recharts usa as CSS variables `--chart-1..6` já existentes no tema, mantendo consistência com Dashboard/Financeiro.
- Sessões em aberto (`ended_at IS NULL`) são excluídas das agregações mas contadas como "Sessões em andamento" em um pequeno badge.
- Consulta com `.select("... ")` tipada como `string` via helper `sel()` para evitar o custo de parsing do tipo do Supabase (padrão do projeto).
- Nenhuma alteração de schema além do seed de `role_permissions` para o novo recurso `time_reports`.

## Passos de implementação
1. Migração: `INSERT INTO role_permissions (role, resource, action)` para `('admin','time_reports','view')` e `('gerente','time_reports','view')` (idempotente com `ON CONFLICT DO NOTHING`).
2. Atualizar `Resource` em `src/lib/permissions.tsx`.
3. Adicionar item de menu em `src/routes/_app.tsx`.
4. Criar `src/routes/_app/tempo.tsx` com filtros, KPIs, gráficos (LineChart, BarChart x2, PieChart) e tabelas descritas.
5. Verificar build/typecheck.
