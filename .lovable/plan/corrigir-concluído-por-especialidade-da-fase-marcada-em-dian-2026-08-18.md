# Corrigir "concluído" por especialidade: da fase marcada em diante

## O que está acontecendo

O José Henrique é Designer, e a especialidade Designer tem "Revisão" marcada como fase de conclusão. Mas hoje o sistema só considera entregue a demanda que está exatamente em "Revisão". Demandas que já avançaram para fases posteriores — Validação do cliente, Programado, Enviado, Concluído — voltam a contar como abertas e atrasadas para ele.

Confirmado no banco: Revisão é a 4ª fase; Programado e Enviado são a 6ª e Concluído a 7ª. As demandas dele que aparecem como atrasadas estão justamente nessas fases posteriores.

## Como vai ficar

- "Concluído" passa a valer **da fase marcada em diante**: marcando Revisão no Designer, tudo de Revisão para frente (Validação, Programado, Enviado, Concluído) conta como entregue para ele.
- Fases marcadas como etapa final no cadastro global continuam contando como entregues para todo mundo, mesmo sem regra da especialidade.
- Reflexo imediato nos indicadores do Dashboard (Em aberto, Urgentes, Atrasados, Concluídos), no widget "Demandas atrasadas", na carga por profissional e no card de fases.
- Também vale quando o administrador filtra por um membro: usa a regra da especialidade daquele membro.
- Demandas em fases anteriores à fase de "Início" do membro deixam de entrar nas contagens dele (hoje o corte de início só é aplicado na tela de Demandas).

## Detalhes técnicos

- `src/lib/access-sections.ts`: em `buildStageRules` e `useStageRules`, trocar a checagem `doneStatusIds.has(statusId)` por comparação de ordem — calcular `doneFromOrder = min(sort_order das fases marcadas)` e considerar entregue quando `statusOrder.get(statusId) >= doneFromOrder`, mantendo o `OR finalStatusIds.has(statusId)`.
- `useStageRulesFor(userId)` passa a derivar o mesmo `doneFromOrder` a partir das regras do usuário consultado.
- `src/routes/_app/dashboard.tsx`: aplicar `stageRules.isStarted(p.status_id)` no conjunto base de demandas dos widgets por pessoa, além do `isDone` já usado.
- Sem mudanças de banco.
