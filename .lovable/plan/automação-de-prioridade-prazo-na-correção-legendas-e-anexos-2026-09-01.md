# Automação de prioridade, prazo na correção, legendas e anexos múltiplos

Cinco melhorias em Demandas e Calendário.

## 1. Pergunta de prazo ao mover para Correção

- Ao mover uma demanda para a fase **Correção** (arrastar no Kanban, trocar a etapa na Lista, no modal de detalhes ou no Calendário), abre um modal: "Deseja alterar o prazo de entrega?".
- Opções: escolher uma nova data de entrega e salvar, ou "Manter prazo".
- A mudança de etapa acontece de qualquer forma; o modal só ajusta o prazo depois.
- A automação já existente (prioridade sobe para Alta na Correção) continua igual.
- Quem não tem permissão de editar o campo de prazo não vê a pergunta.

## 2. Prioridade automática pela data

Régua (dias restantes até a data de referência):

| Faltam | Prioridade |
| --- | --- |
| até 1 dia (ou vencida) | Urgente |
| 2 a 5 dias | Alta |
| 6 a 10 dias | Média |
| acima de 10 dias | Baixa |

Data de referência: **data de postagem** quando existir; caso contrário, o **prazo de entrega**.

Comportamento escolhido:

- **No cadastro/edição**: ao escolher a data, o campo Prioridade já vem preenchido com a sugestão, com um aviso discreto ("sugerido pela data"). O usuário pode trocar manualmente e a escolha é salva.
- **Diariamente, só sobe**: uma rotina diária reavalia as demandas abertas (não entregues) e **eleva** a prioridade quando a data se aproxima. Nunca rebaixa — quem marcou Urgente na mão continua Urgente.
- Demandas sem nenhuma das duas datas ficam de fora.

Ponto para você decidir depois, se quiser: hoje a rotina roda 1x por dia de madrugada. Uma frequência maior aumenta custo sem ganho real, já que a régua é em dias.

## 3. Legenda de cores no Calendário

- Bloco de legenda acima da grade, com duas linhas: **Fluxo** (uma bolinha por etapa, com a cor cadastrada) e **Prioridade** (uma bolinha por prioridade).
- Recolhível, para não ocupar espaço em telas menores.
- Só lista as etapas que aquele usuário pode ver (ver item 4).

## 4. Fases visíveis no Calendário por especialidade

- Em **Perfis e Acessos**, o menu **Calendário** ganha seu próprio bloco de **Fases**, independente do de Demandas.
- Marcando/desmarcando "Ver", a especialidade passa a enxergar ou não as demandas daquela etapa no calendário.
- Padrão preservado: sem nenhuma regra cadastrada para Calendário, tudo continua visível.
- O filtro de Etapa do calendário passa a listar só as fases liberadas.

## 5. Vários arquivos no material do cliente

- O bloco "Material do cliente" (em Demandas e no modal do Calendário) passa a aceitar **múltiplos arquivos**: seleção de vários de uma vez e novos envios somam à lista.
- Cada arquivo aparece com nome, botão Baixar e botão Excluir.
- Os materiais já enviados continuam aparecendo normalmente.

## Detalhes técnicos

- **Banco (uma migração)**:
  - Nova tabela `project_deliverables` (project_id, file_name, file_path, file_size, mime_type, uploaded_by) com GRANTs, RLS espelhando as políticas de `project_attachments`, e backfill dos `projects.deliverable_path` existentes. O campo antigo permanece como fallback de leitura.
  - Função `public.apply_auto_priority()`: recalcula prioridade das demandas abertas pela régua acima, só elevando (`priorities.level` maior).
  - Job `pg_cron` diário (03:00 UTC) chamando essa função — trabalho 100% SQL, sem endpoint HTTP.
- **`src/lib/auto-priority.ts`** (novo): régua compartilhada `suggestPriority(dateISO, priorities)` usada no formulário de cadastro/edição.
- **`src/routes/_app/projects.tsx`**: sugestão de prioridade ao mudar data no `NewDemandDialog`; modal `AskDeadlineDialog` disparado quando `status_id` novo é a etapa Correção (drag do Kanban, select da Lista e do detalhe); material do cliente migrado para lista múltipla (`project_deliverables`, bucket `project-files`, upload em laço, signed URL para baixar, remove no excluir).
- **`src/routes/_app/calendario.tsx`**: legenda recolhível; filtro por `useCalendarStageGate`; mesmo modal de correção no select de etapa; bloco de material do cliente com lista múltipla.
- **`src/lib/access-registry.ts`**: `calendarStageKey(statusId)` = `menu:/calendario#stage:<id>` e geração dos itens `kind: "Fase"` também no menu `/calendario`.
- **`src/lib/access-sections.ts`**: `useCalendarStageGate()` no mesmo padrão de `useStageGate()`.
- **`src/components/PermissionTree.tsx`**: renderizar o novo bloco de fases do Calendário, incluído em "Liberar tudo"/"Limpar regras".
