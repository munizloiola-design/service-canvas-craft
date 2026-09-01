# Trocar a etapa da demanda no modal do Calendário

Hoje o modal da demanda no Calendário mostra a etapa apenas como um selo colorido, sem edição. A ideia é permitir mudar a etapa direto ali, igual ao que já existe na Lista e no detalhe de Demandas.

## Como vai funcionar

- No cabeçalho do modal, o selo da etapa vira um **seletor de etapa**: ao clicar, abre a lista de fases do fluxo (com a cor de cada uma) e a escolha salva na hora.
- O seletor lista apenas as fases que o usuário tem permissão de ver no Calendário (regra de fases por especialidade já existente).
- Quem **não tem permissão de editar** o campo Etapa (Perfis e Acessos) continua vendo apenas o selo, sem poder trocar.
- Ao mover para a etapa **Correção**, abre a mesma pergunta já usada em Demandas: "Deseja alterar o prazo de entrega?" (modal `CorrectionDeadlineDialog`), com opções de salvar novo prazo ou manter.
- Depois da troca, o calendário e o card da demanda atualizam na hora (cor, coluna e filtros), sem precisar recarregar.
- A automação já existente continua valendo: entrar em Correção eleva a prioridade para Alta automaticamente.

## Detalhes técnicos

Arquivo: `src/routes/_app/calendario.tsx`.

- Substituir o `Badge` da etapa (linhas ~586-594) por um `Select` controlado, com `SelectItem` por fase visível (`useCalendarStageGate`), mostrando bolinha com a cor da fase.
- Mutation `update({ status_id })` na tabela `projects`, invalidando `projects-cal` e atualizando o `detail` local; erro exibe toast.
- Gate de edição via `useFieldVisibility().canEdit("status_id")` — sem permissão, renderiza o selo atual.
- Estado `correctionTarget` + render do `CorrectionDeadlineDialog` (componente já existente em `src/components/CorrectionDeadlineDialog.tsx`), disparado quando a nova etapa é Correção (`isCorrecaoStatus`).
- Sem mudanças de banco, RLS ou outras telas.
