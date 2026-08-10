# Por que a demanda concluída aparece como atrasada

## Diagnóstico (confirmado no banco)

A demanda "video márjore – Farm Inova" está na etapa **Concluído** com prazo 06/08/2026.

O sistema não olha o nome da etapa: ele considera "finalizada" apenas as etapas marcadas com a flag **etapa final**. Hoje, nas etapas cadastradas:

- `Publicação` → marcada como etapa final
- `Concluído` → **não** está marcada como etapa final

Ou seja, tudo que está em "Concluído" continua sendo contado como demanda em aberto e, se o prazo já passou, como atrasada (no card "Atrasados", no widget "Demandas atrasadas" e no filtro rápido).

## Correção

1. Marcar `Concluído` como etapa final (migração de banco, atualizando `workflow_statuses.is_final`).
2. Manter `Publicação` também como final, já que a demanda pode encerrar por lá (ambas passam a encerrar o ciclo).
3. Nenhuma mudança de código é necessária — a lógica já respeita a flag.

## Detalhes técnicos

- Migração: `update public.workflow_statuses set is_final = true where name in ('Concluído','Publicação');`
- Contadores afetados automaticamente: `dashboard.tsx` (`isDone`, `overdue`, `open`, `urgent`), widget `OverdueProjects`, filtro `quick=atrasadas` em `projects.tsx`.

## Observação

Se "Publicação" **não** deve encerrar a demanda (por exemplo, ela ainda segue para "Concluído"), me avise: nesse caso deixo apenas "Concluído" como final.
