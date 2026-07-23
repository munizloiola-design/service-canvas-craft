Remover o campo **Nome** do formulário da modal de criação/edição de times em `src/routes/_app/squad.tsx`, mantendo apenas a barra de pesquisa e a seleção de membros.

### Alterações

1. **Remover o campo "Nome"** do JSX da modal (`TeamDialog`), incluindo o `Label`, o `Input` e a validação obrigatória (`if (!name.trim())`).
2. **Manter a geração automática do nome** para preservar a integridade da coluna `name` (NOT NULL) na tabela `teams`:
   - Ao criar um novo time, gerar um nome padrão automaticamente (ex.: "Novo time", "Time #<timestamp>" ou baseado na data).
   - Ao editar um time existente, manter o nome já cadastrado sem exibi-lo na modal.
3. **Manter a seleção de membros** com a barra de pesquisa e a lista de checkboxes exatamente como está.
4. **Garantir que o botão "Salvar"** continue funcionando e que o toast de erro não exija mais o nome.

### Resultado esperado

A modal de criar/editar time exibirá apenas a barra de pesquisa de membros e a lista de seleção, sem o campo "Nome".