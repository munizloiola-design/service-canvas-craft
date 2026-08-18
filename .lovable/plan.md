# Fase de início e fase de conclusão por especialidade

Hoje "concluído" é único para todo mundo: vem da marcação `Etapa final` do cadastro de Etapas do fluxo. Por isso a demanda em "Em revisão" conta igual para Designer e Social Media. A ideia é deixar cada especialidade dizer, dentro de Perfis e Acessos, a partir de qual fase a demanda entra na conta dela e a partir de qual fase ela já é considerada entregue.

## Como vai funcionar

Em **Perfis e Acessos → Especialidade**, dentro do bloco **Demandas** (onde já se marca quais fases a especialidade enxerga), cada fase ganha duas marcações extras:

```text
Fases de Demandas                     Ver   Início   Concluído
  Aguardando produção                 [x]     (o)      ( )
  Em produção                         [x]     ( )      ( )
  Em revisão                          [x]     ( )      [x]      <- Designer
  Aprovação do cliente                [x]     ( )      ( )
  Publicação                          [x]     ( )      [x]      <- Social Media
```

- **Início**: uma única fase por especialidade. A demanda só entra na visão e nos números daquela especialidade quando chega nessa fase (fases anteriores somem do Kanban e da Lista, como você pediu).
- **Concluído**: uma ou mais fases. Da fase marcada em diante, a demanda conta como entregue para aquela especialidade e deixa de ser "aberta" ou "atrasada".
- Quem tem mais de uma especialidade recebe a regra mais abrangente (início mais cedo, conclusão em qualquer fase marcada por uma delas).
- Sem nada marcado, tudo segue como hoje: todas as fases visíveis e "concluído" pela marcação global de etapa final.
- Admin/Gerente continuam com visão total.

## Onde a regra passa a valer

- **Demandas (Kanban e Lista)**: some quem está antes da fase de início; a permissão de fase atual continua valendo por cima.
- **Dashboard**: Total, Abertas, Concluídas, Urgentes e Atrasadas usam a conclusão da especialidade do usuário; o widget de atrasadas também.
- **Relatórios (Squad e Tempo)**: contagem de entregas segue a mesma definição.

## Detalhes técnicos

- Nova tabela `public.specialty_stage_rules (specialty_id, status_id, is_start boolean, is_done boolean)` com PK composta, GRANTs para `authenticated`/`service_role`, RLS: leitura para usuários internos, escrita só para gerentes/admin. Índice único parcial garantindo uma só fase de início por especialidade.
- `src/lib/access-context.tsx`: carregar as regras das especialidades do usuário e expor `startStageOrder` e `doneStatusIds`.
- `src/lib/access-sections.ts`: novo hook `useStageRules()` devolvendo `isVisibleStage(statusId)`, `isDone(project)` e `hasRules`, com fallback para `workflow_statuses.is_final`.
- `src/components/PermissionTree.tsx`: nas linhas de fase, adicionar o radio "Início" e o checkbox "Concluído", salvando em lote na nova tabela.
- `src/routes/_app/projects.tsx`: aplicar o corte da fase de início junto do filtro de fases já existente (Kanban e Lista).
- `src/routes/_app/dashboard.tsx`, `src/routes/_app/squad.relatorio.tsx` e `src/routes/_app/tempo.tsx`: trocar o uso direto de `is_final` pelo `isDone` do hook.
