## Por que o CRM parece vazio

- A tabela `crm_stages` tem 6 fases (Novo lead, Qualificação, Proposta enviada, Negociação, Ganho, Perdido).
- A tabela `clients` tem **0 registros com `status = 'prospeccao'`**, então não há nada para desenhar.
- O componente `CrmTab` esconde totalmente o kanban quando `total === 0`, mostrando só um card de estado vazio. Resultado: você não vê nem as fases, nem consegue arrastar/cadastrar dali.

## O que ajustar em `src/routes/_app/clientes.crm.tsx` + `CrmTab` em `src/routes/_app/clientes.tsx`

1. **Sempre renderizar as colunas do pipeline**
   - Remover a condição `total > 0` para o grid; desenhar uma coluna por estágio mesmo sem prospects.
   - Em colunas vazias, mostrar placeholder "Arraste um card aqui ou clique em + para adicionar".

2. **Botão "Novo prospect" no topo do CRM**
   - Adicionar botão ao lado de "Gerenciar estágios" que abre um diálogo mínimo (nome do cliente, telefone, valor estimado, estágio inicial, próxima ação).
   - Ao salvar: `insert` em `clients` com `status = 'prospeccao'` e `prospect_stage` = estágio selecionado, invalidando `["clients"]`.
   - Também aceitar um ícone `+` no cabeçalho de cada coluna que abre o mesmo diálogo já com o estágio pré-selecionado.

3. **Manter o empty state atual só como dica curta acima do kanban** quando `total === 0` ("Nenhum prospect ainda. Use + para criar o primeiro."), sem esconder as colunas.

4. **Ganho/Perdido**: seguem funcionando como hoje (mudam `status` para `ativo`/`inativo` ao arrastar/clicar), sem alteração de regra.

Sem mudanças no banco — os estágios já existem e a policy de `clients` já permite gerentes/admins criarem registros.

## Fora de escopo

- Alterar `crm_stages` (usar as fases atuais).
- Mexer em outras abas de `/clientes` (Diretório, Portal, Briefing, Projetos).
