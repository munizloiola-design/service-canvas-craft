# Eficiência e atraso: respeitar a etapa de conclusão de cada especialidade

## Situação atual (verificada)

Regras cadastradas hoje em Perfis e Acessos:

- **Designer** — início: Aguardando Produção · conclusão: **Revisão** · data base: Prazo
- **Social Media** — início: Planejamento · conclusão: **Validação do cliente** · data base: Prazo

No dashboard:

- Ao **filtrar por membro**, as contagens já usam as regras da especialidade dele (conclusão e data base).
- **Sem filtro** (visão do admin), o sistema ignora as especialidades e considera concluído apenas a etapa marcada como final no fluxo. A data de referência cai sempre no Prazo.

## O que muda

Confirmado: a visão geral do admin **continua usando a etapa final global** como definição de concluído. O ajuste fica na **data de referência do atraso**, que passa a respeitar a base (Prazo ou Postagem) de cada responsável da demanda.

1. Para cada demanda, reunir as bases de data das especialidades dos responsáveis marcados nela.
2. O prazo efetivo da demanda passa a ser a data correspondente a essas bases (quando houver mais de uma, vale a mais próxima).
3. Demanda sem responsável ou sem especialidade cadastrada continua no comportamento atual (Prazo, com Postagem como reserva).
4. Ao filtrar por membro, nada muda: valem integralmente as regras daquele perfil (início, conclusão e data base).
5. Um texto de apoio no card Eficiência deixa explícito o critério em uso ("etapa final do fluxo" na visão geral, "regras do perfil" ao filtrar por membro).

## Detalhes técnicos

- `src/routes/_app/dashboard.tsx`: no hook `useLateness`, quando não há membro em escopo, montar um mapa `projeto → bases de data` a partir de `project_assignees` → `user_specialties` → `provider_specialties.date_basis`, e passar um `refDates` que usa esse mapa por demanda (fallback para a base atual).
- `src/lib/dashboard-efficiency.ts`: `computeLateness` já recebe `refDates` como função por demanda; nenhuma mudança de assinatura necessária.
- `src/lib/access-sections.ts`: sem alteração de comportamento; apenas expor um helper para resolver bases por conjunto de usuários, reutilizado pelo dashboard.
- Consulta extra: uma query agregada de especialidades dos responsáveis, cacheada por React Query, sem chamada por demanda.
