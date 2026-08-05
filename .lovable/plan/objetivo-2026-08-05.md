## Objetivo

Corrigir a criação de demandas bloqueada pela segurança do banco e adicionar o campo **Legenda** imediatamente após **Direção de arte**.

## Diagnóstico confirmado

- A tabela `projects` está com RLS ativa e o papel autenticado possui permissão de `INSERT`.
- A policy efetiva de criação aceita apenas quem passa em `is_manager(auth.uid())` ou `has_menu_access(auth.uid(), '/projects')`.
- O acesso por menu é calculado pela cadeia **usuário → especialidade → área → menu visível**; há áreas com `/projects` habilitado, mas também existe perfil cujo acesso calculado a esse menu é falso.
- O formulário grava primeiro em `projects` e só depois inclui os responsáveis em `project_assignees`; portanto, o erro informado ocorre antes da gravação dos responsáveis.
- **Direção de arte** usa hoje a coluna `projects.notes`; ainda não existe uma coluna própria para **Legenda**.

## Implementação

1. **Corrigir a autorização de criação**
   - Reproduzir com a sessão autenticada que apresenta o erro e conferir o `auth.uid()` contra a atribuição vigente em **Perfis e Acessos**.
   - Ajustar a policy/função de acesso para refletir exclusivamente a autorização real de `/projects` configurada em **Perfis e Acessos**, mantendo RLS ativa e sem liberar criação para todos os usuários autenticados.
   - Alinhar o botão **Nova demanda** e as ações de edição com a mesma regra de menu usada pelo banco, removendo a divergência atual em que a interface ainda depende de `isManager`.
   - Preservar as regras atuais de leitura, exclusão e isolamento de clientes.

2. **Adicionar Legenda**
   - Criar a coluna opcional `caption text` em `projects` por migration.
   - Adicionar **Legenda** logo abaixo de **Direção de arte** no cadastro e na edição, persistindo o conteúdo no novo campo.
   - Mostrar a legenda no detalhe da demanda, também após **Direção de arte**.
   - Registrar `caption` em **Perfis e Acessos** como campo configurável de visualização/edição e incluí-lo na camada de visibilidade de demandas.

3. **Validação**
   - Testar a criação com um usuário autorizado a `/projects` apenas por **Perfis e Acessos**.
   - Confirmar que a demanda e seus responsáveis são gravados e reaparecem após atualizar a tela.
   - Criar e editar uma demanda com legenda, verificando persistência, posição no formulário e exibição no detalhe.
   - Confirmar que um usuário sem `/projects` continua impedido de criar demandas.

## Detalhes técnicos

- Mudança de schema: `ALTER TABLE public.projects ADD COLUMN caption text`.
- A policy continuará restrita a usuários autenticados e será baseada na autorização centralizada de menu, sem policy aberta para `anon` ou para todo `authenticated`.
- Arquivos principais: formulário/detalhe de demandas, registro de campos e migration do banco.