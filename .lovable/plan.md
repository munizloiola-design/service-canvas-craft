## Objetivo

Adicionar gestão de **Equipes** vinculadas a clientes, permitindo pré-preenchimento automático dos membros ao criar uma demanda (com opção de ajustar).

## Estrutura no banco

Nova tabela `client_teams`:
- `client_id` (FK clients)
- `name`
- `is_default` (equipe padrão do cliente)

Nova tabela `client_team_members`:
- `team_id` (FK client_teams)
- `user_id` (FK auth.users)
- `role_hint` (opcional, texto — ex: "Designer responsável")

Alteração em `projects`:
- `team_id` (FK client_teams, nullable) — registra qual equipe originou os assignees do projeto.

GRANTs + RLS: leitura/edição para admin/gerente; membros leem equipes das quais participam; cliente lê apenas as próprias.

## Interface de gestão (Admin/Gerente)

Nova aba **"Equipes"** dentro de `/clientes-area` (ao lado de Clientes / Cadastro estratégico / Acesso ao portal):
- Lista de equipes por cliente selecionado.
- CRUD de equipes (nome, marcar como padrão).
- Dentro de cada equipe: adicionar/remover membros da agência (busca em `profiles`), definir uma como padrão do cliente.

## Integração na criação de demanda

Em `src/routes/_app/projects.tsx` (formulário de nova demanda):
1. Ao selecionar o **cliente**, buscar as equipes daquele cliente.
2. Mostrar um seletor **"Equipe"** logo abaixo do cliente:
   - Se houver equipe padrão → pré-selecionada.
   - Se houver só uma → pré-selecionada.
   - Opção "Sem equipe / personalizado".
3. Ao selecionar uma equipe, preencher automaticamente a lista de **assignees** (`project_assignees`) com os membros da equipe.
4. O usuário pode **adicionar ou remover** membros manualmente antes de salvar (a alteração não modifica a equipe original).
5. Salvar `team_id` no projeto para referência.

Edição de demanda: mesmo comportamento — trocar equipe repropõe membros (com confirmação), manter manual permite ajuste livre.

## Detalhes técnicos

- Migração única com as 2 novas tabelas + coluna `team_id` em `projects` + GRANTs + RLS + trigger `updated_at`.
- Server fns em `src/lib/client-teams.functions.ts`: `listTeamsByClient`, `createTeam`, `updateTeam`, `deleteTeam`, `setTeamMembers`, `setDefaultTeam`.
- Reaproveitar componente de multi-seleção de usuários já usado em assignees.
- Sem mudanças em permissões existentes; adicionar `equipes_cliente` como recurso opcional só se necessário (por padrão herda de `clientes_area`).

## Fora do escopo

- Não altera fluxo de portal do cliente (equipes são gestão interna).
- Não envia notificações automáticas aos membros da equipe.