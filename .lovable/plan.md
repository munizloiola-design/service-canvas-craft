# Dashboard: atrasadas + indicadores clicáveis

## O que muda

### 1. "Atrasados" nos Indicadores gerais
O bloco ganha um sexto card: **Atrasados** — demandas com data de entrega anterior a hoje e que ainda não estão em etapa final. Ícone de alerta em vermelho, no mesmo padrão dos outros.

Cards finais: Total · Em aberto · Concluídos · Urgentes · **Atrasados** · Equipe.

### 2. Indicadores viram botões
Cada card passa a ser clicável e leva para Demandas já filtrado:

- Total → Demandas (sem filtro)
- Em aberto → Demandas filtradas por etapas não finais
- Concluídos → Demandas concluídas
- Urgentes → Demandas com prioridade mais alta, ainda abertas
- Atrasados → Demandas atrasadas
- Equipe → página Equipe

Visualmente: hover com leve destaque, cursor de mão e seta discreta no canto. Se a pessoa não tiver acesso ao menu de destino, o card continua aparecendo, mas sem link (não vira botão).

### 3. Novo widget "Demandas atrasadas"
Widget de tamanho médio, disponível em "Adicionar widget", com:

- Lista das demandas vencidas (mais atrasadas primeiro, até 8 itens)
- Título, cliente, data de entrega e quantos dias de atraso (badge vermelha)
- Clique no item abre a demanda; rodapé com "Ver todas" quando houver mais
- Estado vazio: "Nenhuma demanda atrasada"

O widget respeita a mesma regra de visibilidade das demandas: administradores e gerentes veem tudo, os demais veem só onde estão marcados como responsáveis.

## Detalhes técnicos

- `src/routes/_app/dashboard.tsx`:
  - `StatsOverview`: buscar também `due_date` e `assigned_to` em `projects`; calcular `atrasados` = `due_date < hoje` e status não final. Cards passam a renderizar `Link` (TanStack) quando houver destino permitido por `menuAllowed`.
  - Novo entry no catálogo `WIDGETS`: `overdue_projects` (`label: "Demandas atrasadas"`, `size: "md"`, `menu: "/projects"`), novo `case` em `WidgetRenderer` e componente `OverdueProjects`.
  - Reaproveitar o padrão de `UpcomingDeadlines` (join local com `clients`, `Link` para `/projects?detail=<id>`).
- `src/routes/_app/projects.tsx`: ampliar `validateSearch` com `quick?: "abertas" | "concluidas" | "urgentes" | "atrasadas"` e, no mount, converter esse valor em um `ActiveFilter` correspondente (mesma estrutura já usada pelos filtros da tela). Sem `quick`, comportamento atual inalterado.
- Nada muda no banco.
