# Dashboard por membro da equipe

## O que muda

1. **Sai o card "Equipe"** dos Indicadores gerais. Ficam 5 cards: Total, Em aberto, Concluídos, Urgentes, Atrasados.

2. **Filtro de membro no topo do Dashboard (só Admin/Gerente)**
   Um seletor "Visualizando: Toda a equipe / [pessoa]" ao lado do botão Personalizar.
   Ao escolher uma pessoa, os widgets de demanda passam a mostrar apenas o que aquela pessoa é responsável (responsável principal ou marcado em responsáveis).

3. **Colaborador vê só o dele**
   Sem seletor: os indicadores e widgets de demanda já ficam travados nas demandas em que a pessoa está marcada — que é o comportamento atual de visibilidade, agora aplicado também aos números dos cards.

## Widgets afetados pelo filtro

- Indicadores gerais (Total, Em aberto, Concluídos, Urgentes, Atrasados)
- Demandas atrasadas
- Próximos prazos
- Projetos por etapa
- Projetos recentes

Widgets financeiros, de CRM, tickets, equipamentos e depreciação não são por pessoa e continuam iguais. "Carga por profissional" continua mostrando toda a equipe (é o comparativo entre pessoas), mas destaca a pessoa selecionada.

## Detalhes técnicos

- Um contexto local no `dashboard.tsx` (`DashboardScopeContext`) guarda `scopeUserId`: `null` = toda a equipe (só admin/gerente), caso contrário o id da pessoa.
- Para não-gestores, `scopeUserId` é forçado ao próprio `user.id` e o seletor não é renderizado.
- O hook `useVisibleProjects` já existente passa a receber o escopo: filtra por `projects.assigned_to = scopeUserId` OU presença em `project_assignees` daquele usuário; com escopo nulo e gestor, devolve tudo.
- A lista de pessoas do seletor vem de `internal_profiles` (mesma fonte usada hoje pelo contador de equipe).
- Os links dos cards para `/projects` mantêm o filtro rápido atual; quando houver pessoa selecionada, nada muda na URL de Demandas (o filtro do dashboard é apenas de leitura).
