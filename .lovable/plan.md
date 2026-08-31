# Correção de datas exibidas + ocultar entregues na Lista

## 1. Datas estão aparecendo UM DIA ANTES do cadastrado

**Diagnóstico confirmado no código:** as datas são gravadas corretamente no banco (ex.: `2026-08-31`), mas na hora de exibir várias telas usam `new Date("2026-08-31")`, que o navegador interpreta como meia-noite em UTC. Como estamos em UTC-3 (São Paulo), essa meia-noite vira 21h do dia anterior, e a data exibida sai como **30/08** em vez de **31/08**.

Ou seja: o cadastro está certo, a **exibição** está errada em várias telas.

**Onde está errado (confirmado):**
- `src/routes/_app/projects.tsx` — card do Kanban, colunas Prazo/Postagem da Lista, modal de detalhes (Início/Prazo/Postagem)
- `src/routes/portal/pendentes.tsx`, `portal/calendario.tsx`, `portal/aprovados.tsx` — portal do cliente
- `src/routes/_app/dashboard.tsx` — linhas 727 e 973

**Onde já está certo:** modal do calendário interno e parte do dashboard já usam o formato correto (`+ "T00:00:00"`).

**Correção:**
- Criar um utilitário único `formatDateBR()` em `src/lib/dates.ts` que interpreta a data como local (sem conversão de fuso).
- Substituir todas as chamadas problemáticas listadas acima pelo utilitário.

## 2. Lista: opção de ocultar demandas entregues

Hoje a Lista mostra todas as demandas, incluindo as que já constam como "entregue" para a especialidade do usuário (ex.: para o Designer, tudo que passou de Revisão).

**Implementação:**
- Adicionar um controle "Mostrar entregues" (toggle/checkbox) na barra de filtros da visualização em **Lista**, usando a mesma regra de início/conclusão por especialidade já existente (`stageRules.isDone`).
- Padrão: **ocultar entregues**; ao ativar o toggle, elas reaparecem.
- Preferência fica salva no navegador (mesmo padrão dos filtros persistidos já existentes).
- Kanban e Calendário não são alterados.

## Arquivos alterados
- `src/lib/dates.ts` (novo utilitário)
- `src/routes/_app/projects.tsx`
- `src/routes/_app/dashboard.tsx`
- `src/routes/portal/pendentes.tsx`, `portal/calendario.tsx`, `portal/aprovados.tsx`

Nenhuma alteração de banco de dados é necessária — os dados gravados estão corretos.
