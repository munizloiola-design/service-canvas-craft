# Atrasados: contar também o que atrasou e já foi resolvido

## O problema

Hoje "Atrasados" só conta demanda que **ainda está aberta** com prazo vencido (`due_date < hoje` e não concluída). Assim que a pessoa entrega, o atraso some do indicador — e a taxa de eficiência fica desalinhada do card. Além disso, o card usa sempre o campo **prazo**, ignorando os perfis cujo indicador é a **data de postagem**, e não aplica o corte da fase de início do perfil.

## Como vai ficar

O atraso passa a ser um fato histórico: **atrasou uma vez, conta como atrasada apenas para o calculo, pois quando sair do quadro kanban de finalização não contabiliza nos atrasados do dashboard**, mesmo depois de resolvida.

Uma demanda é atrasada quando:

- a data de referência do perfil já passou e ela ainda não está concluída, **ou**
- ela foi concluída **depois** da data de referência.

Data de referência conforme o perfil de acesso:

- perfis com indicador **Entrega (prazo)** → usa a data de entrega (cai para postagem se não houver);
- perfis com indicador **Postagem** → usa a data de postagem (cai para entrega se não houver);
- quem tem mais de uma especialidade usa a data mais apertada entre elas.

Regras de fase respeitadas:

- demandas antes da **fase de início** do perfil não entram na conta dele;
- "concluída" é a **fase de conclusão do perfil em diante** (ex.: Revisão para o Designer), não a etapa final global;
- com o filtro em "Todos", vale a marcação global de etapa final, como hoje.

Na tela:

- Card **Atrasados** mostra o total (aberto + resolvido com atraso) e, abaixo, "X ainda em aberto".
- Modal do card lista as duas situações, com etiqueta **Resolvida com atraso** nas que já foram entregues.
- Widget **Demandas atrasadas** continua listando só as que ainda estão em aberto (é a lista de ação), agora usando a data de referência do perfil.
- O card **Eficiência** passa a usar exatamente o mesmo conjunto de atrasadas, então os dois números batem.

## Detalhes técnicos

- `src/lib/dashboard-efficiency.ts`: extrair `computeLateness(projects, { isDone, refDates, today, doneDates })`, devolvendo `{ lateIds, openLateIds }`; `computeEfficiency` passa a consumir esse resultado em vez de recalcular o atraso.
- `src/routes/_app/dashboard.tsx`:
  - mover o cálculo de `doneDates` (primeira transição para uma fase de conclusão do perfil) e `regressedIds` para um hook local `useLateness(projects)`, reutilizado por `StatsOverview` e `OverdueProjects` (query `project_transitions` já existente, com a mesma chave de cache);
  - `overdue` passa a ser `lateIds.size`, com `sub` = "X ainda em aberto" (`openLateIds.size`) e `filter` do modal = `lateIds.has(p.id)`;
  - etiqueta "Resolvida com atraso" no modal quando `lateIds.has(p.id) && isDone(p)`;
  - `OverdueProjects` troca a comparação direta `due_date < hoje` por `openLateIds`, ordenando pelo maior atraso sobre a data de referência.
- Sem mudanças de banco.