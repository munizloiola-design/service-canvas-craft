# Dashboard: filtro de mês e taxa de eficiência

## 1. Filtro de mês

Um seletor de mês no topo do Dashboard, ao lado do filtro de membro (Mês atual por padrão, com navegação anterior/próximo e opção "Todos os períodos").

Ele vale para todos os widgets de demanda: Indicadores gerais, Demandas atrasadas, Próximos prazos, Projetos por etapa e Projetos recentes. Widgets financeiros, CRM, tickets e equipamentos seguem como estão.

### Qual data conta como "o mês"

Como você apontou, a data que importa muda conforme a atuação: para o Designer vale o prazo de entrega, para o Social Media vale a data de postagem. Então a data de referência passa a ser uma configuração por especialidade, em Perfis e Acessos:

```text
Especialidade: Designer        Data de referência: (o) Prazo de entrega  ( ) Postagem
Especialidade: Social Media    Data de referência: ( ) Prazo de entrega  (o) Postagem
```

- A demanda entra no mês pela data escolhida pela especialidade da pessoa; se essa data estiver vazia, cai na outra como reserva.
- Quem tem mais de uma especialidade: a demanda entra no mês se qualquer uma das datas de referência dele cair no mês.
- Sem configuração (ou filtro em "Toda a equipe"): usa o prazo de entrega, com postagem como reserva.

## 2. Taxa de eficiência

Novo card nos Indicadores gerais, no mesmo padrão dos demais, mostrando um percentual grande e, abaixo, os dois componentes.

Sobre as demandas do mês já concluídas (usando a regra de "concluído" da especialidade que já existe):

- **Pontualidade** = concluídas dentro da data de referência ÷ concluídas
- **Taxa de retorno** = demandas que voltaram ÷ concluídas
- **Eficiência** = Pontualidade − Taxa de retorno (mínimo 0%)

Conta como "retorno" (os dois somados, sem duplicar a mesma demanda):
- decisão do cliente registrada como reprovado, e
- qualquer movimentação da demanda para uma fase anterior no histórico.

Cor do número: verde acima de 85%, âmbar entre 60% e 85%, vermelho abaixo. Ao clicar, abre a mesma modal de detalhamento já usada pelos outros indicadores, listando as concluídas do mês com marcação de "atrasada" e "retornada".

Sem demandas concluídas no mês, o card mostra "—" em vez de 0%.

## Detalhes técnicos

- Banco: nova coluna `provider_specialties.date_basis text not null default 'due'` (`'due' | 'post'`). Sem novas tabelas.
- `src/components/PermissionTree.tsx`: seletor de data de referência no cabeçalho do bloco Demandas da especialidade.
- `src/lib/access-sections.ts`: `buildStageRules`/`useStageRules`/`useStageRulesFor` passam a expor também `dateBases: ("due"|"post")[]` e um helper `refDates(project)`; sem regra, `["due"]`.
- Novo `src/lib/dashboard-efficiency.ts` (puro, testável): `computeEfficiency(projects, { monthStart, monthEnd, isDone, refDates, returnedIds })` devolvendo `{ concluded, onTime, returned, punctuality, returnRate, efficiency }`.
- `src/routes/_app/dashboard.tsx`: contexto de escopo ganha `monthRange` (`{start,end} | null`), aplicado dentro de `useVisibleProjects`; queries de `projects` passam a trazer `post_date`, `client_decision` e `client_decided_at`; novo card `Eficiência` em `StatsOverview` reaproveitando a modal existente.
- Retornos por volta de fase: consulta agregada em `project_transitions` (junta `workflow_statuses.sort_order` de `from`/`to`) para o conjunto de demandas do mês, devolvendo o set de `project_id` com pelo menos uma transição regressiva; cacheada por mês/escopo.
- Persistência do mês selecionado via `usePersistedState`, como nos demais filtros.
