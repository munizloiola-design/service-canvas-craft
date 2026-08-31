# Excluir anexos, pesquisa em Demandas e remoção da Eficiência

## 1. Botão de excluir anexos

Hoje o botão de remover anexo só existe dentro do formulário de edição da demanda. Nas telas de visualização (modal de detalhe em Demandas e modal da demanda no Calendário) o anexo só pode ser baixado.

- Ao lado do botão de baixar, cada anexo ganha um botão de lixeira.
- Ao clicar, pede confirmação ("Excluir o anexo X?") e remove tanto o arquivo quanto o registro.
- O botão só aparece para quem pode editar a demanda (mesma regra já usada nos campos editáveis); quem só visualiza continua vendo apenas o download.

## 2. Campo de pesquisa em Demandas

Um campo de busca no cabeçalho da página de Demandas, ao lado dos filtros, valendo para as duas visualizações (Kanban e Lista).

- Busca por título, cliente, legenda e descrição/direção de arte.
- Ignora acentos e maiúsculas/minúsculas.
- Funciona junto com os filtros e filtros rápidos já existentes.
- No Kanban, as colunas passam a mostrar apenas os cards que casam com a busca.
- O texto digitado é lembrado como os demais filtros da página.

## 3. Retirar a Taxa de eficiência

O card "Eficiência" sai dos Indicadores gerais do Dashboard. Os demais cards (Total, Em aberto, Concluídos, Urgentes, Atrasados) e o filtro de mês continuam iguais, e "Atrasados" mantém o "+X resolvidas com atraso".

O cálculo permanece no código, desativado apenas na tela, para poder voltar depois sem retrabalho.

## Detalhes técnicos

- `src/routes/_app/projects.tsx`: no `ProjectDetail`, adicionar mutation `removeAttachment` (storage `project-files` + delete em `project_attachments`, invalidando `["attachments", project.id]`) e botão de lixeira com `AlertDialog`, condicionado a `canManageProjects`/permissão de edição.
- `src/routes/_app/calendario.tsx`: mesma mutation e botão na lista de anexos do modal, invalidando `["project_attachments_cal", detail.id]`.
- `src/routes/_app/projects.tsx`: novo estado `query` via `usePersistedState(persistKey("projects", "search", user?.id), "")`, input com ícone de lupa no header e um passo extra em `filteredProjects` comparando texto normalizado (`normalize` com `String.normalize("NFD")`) contra título, `maps.client.get(p.client_id)`, `caption`, `description` e `notes`.
- `src/routes/_app/dashboard.tsx`: remover a entrada `Eficiência` do array de cards em `StatsOverview` e as ramificações de badge/legenda específicas dessa modal; manter `computeEfficiency`/`dashboard-efficiency.ts` intactos.
- Sem mudanças de banco.
