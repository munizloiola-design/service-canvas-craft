# Controle de acesso por fase do Kanban

Permitir, em Perfis e Acessos, escolher quais fases (etapas do fluxo) cada especialidade pode ver no Kanban de Demandas.

## Como vai funcionar

- Em **Perfis e Acessos → árvore de permissões**, dentro do menu **Demandas** passa a existir um bloco de itens do tipo **Fase**, um para cada etapa cadastrada em Cadastros (as colunas do Kanban). A lista é montada direto do banco, então toda fase nova aparece sozinha.
- Marcando/desmarcando "Ver" em cada fase, a especialidade passa a enxergar ou não aquela coluna.
- No **Kanban**, só aparecem as colunas liberadas. As demandas que estão em fases bloqueadas simplesmente não aparecem no quadro.
- No formulário/edição da demanda, o seletor de **Etapa** e o arrastar-e-soltar só oferecem fases liberadas — evita mover uma demanda para uma coluna que a pessoa não pode ver.
- Comportamento padrão preservado: se a especialidade não tem nenhuma regra cadastrada para Demandas, tudo continua visível. Admin/Gerente seguem com acesso total pela especialidade "Administração › Total".
- A visão **Lista** continua mostrando as demandas normalmente (o controle pedido é do Kanban).

## Detalhes técnicos

- Nova chave de permissão reutilizando a tabela existente `specialty_field_visibility`: `menu:/projects#stage:<status_id>` (mesmo padrão de `sectionKey`).
- `src/lib/access-registry.ts`: adicionar helper `stageKey(statusId)` e permitir que `permissionTree()` receba a lista de `workflow_statuses`, gerando itens `kind: "Fase"` no menu `/projects`.
- `src/components/PermissionTree.tsx`: buscar `workflow_statuses` (id, name, sort_order) e passar para `permissionTree`; renderizar o novo tipo com apenas o checkbox "Ver"; incluir essas chaves nas ações "Liberar tudo"/"Limpar regras".
- `src/lib/access-sections.ts`: expor `canViewStage(statusId)` a partir de `canViewSection`, mantendo o fallback permissivo por menu já existente.
- `src/routes/_app/projects.tsx`: filtrar `statuses` usados nas colunas do Kanban e nas opções de etapa pelo novo gate; filtrar demandas cujo `status_id` esteja em fase bloqueada apenas na visão Kanban.
- Sem migração de banco: a tabela e as políticas atuais já suportam as novas chaves.
