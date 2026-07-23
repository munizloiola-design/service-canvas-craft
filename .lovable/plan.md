Atualmente, um usuário `membro` só enxerga uma demanda se estiver diretamente atribuído (owner ou `project_assignees`). Gestores veem tudo. Vamos adicionar duas exceções de visibilidade para membros comuns: por **equipe** e por **função**.

### O que será alterado

#### 1. Banco de dados
- Criar função `public.can_view_project(_uid uuid, _project_id uuid)` como `SECURITY DEFINER` que retorna `true` quando:
  - O usuário é gestor (`admin` / `gerente` / `admin_master`); ou
  - O usuário é o responsável principal (`assigned_to`); ou
  - O usuário está em `project_assignees`; ou
  - O usuário pertence ao time (`team_members`) vinculado ao projeto (`projects.team_id`); ou
  - O usuário possui uma função (`user_functions`) que coincide com alguma função/papel (`project_assignees.role_id`) exigida pelo projeto.
- Substituir a política `projects_select_scoped` por `can_view_project(auth.uid(), projects.id)`.

#### 2. Frontend
- No formulário de criação/edição de projetos (`src/routes/_app/projects.tsx`), adicionar um campo **Equipe responsável** (`team_id`) que atualmente é sempre enviado como `null`.
- No diálogo de atribuição de responsáveis, exibir um hint indicando que membros do time e usuários com a função correspondente também terão visibilidade da demanda.
- Atualizar o `Project` type para garantir que `team_id` seja manipulado corretamente.

#### 3. Validação
- Criar um projeto, vincular a uma equipe e atribuir uma função; verificar que um membro da equipe e um usuário com a função correspondente visualizam a demanda sem estar no `project_assignees`.

### Regras de acesso finais

| Tipo de usuário | O que consegue ver |
|-----------------|-------------------|
| Gestor | Todas as demandas |
| Cliente | Demandas do seu cliente |
| Membro atribuído | Demandas onde é owner ou está em `project_assignees` |
| Membro de equipe | Demandas cujo `team_id` pertence ao time dele |
| Membro com função | Demandas que usem essa função em `project_assignees` |

