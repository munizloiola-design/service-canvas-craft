## 1. Botão hambúrguer para esconder o menu (desktop)

Arquivo: `src/routes/_app.tsx`

- Adicionar estado `desktopCollapsed` (persistido em `localStorage` como `sidebar:collapsed`) para lembrar a preferência do usuário entre sessões.
- Envolver o `<aside>` desktop com classes condicionais: quando recolhido, `w-0 -ml-64` (ou `hidden`) para sumir com o menu; quando expandido, `w-64`. Usar `transition-all duration-200` para animação suave.
- Adicionar um botão flutuante/fixo no topo do `<main>` (visível apenas em `md:` para cima) com o ícone `Menu` (lucide-react) que alterna `desktopCollapsed`. Quando o menu está aberto o botão vira `PanelLeftClose`; quando recolhido, `PanelLeft`, para deixar claro o estado.
- No mobile nada muda — o botão hambúrguer já existe no topbar.

## 2. Filtro por equipe no Relatório de Tempo

Arquivo: `src/routes/_app/tempo.tsx`

- Estender `SearchParams` com `team?: string` e adicionar `teamFilter` lido de `Route.useSearch()`.
- Nova query `useQuery(["all_teams_min"])` buscando `teams(id, name)` ordenado por nome.
- Nova query `useQuery(["team_members", teamFilter])` — quando houver `teamFilter`, buscar `team_members.user_id where team_id = teamFilter` e guardar em `teamUserIds: string[]`.
- Adicionar um `<Select>` "Equipe" na barra de filtros (grid passa de `md:grid-cols-5` para `md:grid-cols-6`), com opção "Todas as equipes".
- Na query principal `time_logs_report`:
  - Incluir `teamFilter` na `queryKey`.
  - Se `teamFilter` estiver definido e `teamUserIds` carregado, aplicar `.in("user_id", teamUserIds)`. Se a equipe não tiver membros, retornar `[]` sem consultar.
- O filtro se combina com os filtros existentes de Projeto e Usuário (AND). Todos os KPIs, gráficos, tabelas e export CSV consomem `logs`/`closed` derivados dessa query, então já respeitam o novo filtro automaticamente.

Nenhuma mudança de banco de dados; usa as tabelas `teams`/`team_members` já criadas.
