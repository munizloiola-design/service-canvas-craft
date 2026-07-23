## Objetivo

Substituir o modelo atual de "equipes por cliente" (`client_teams` / `client_team_members`, com equipe padrão) por um modelo global de **Times** reutilizáveis. Cada cliente aponta para 1 time; ao criar uma demanda, os membros do time do cliente são pré-preenchidos automaticamente em "Responsáveis", mas o campo continua editável.

## 1. Banco de dados (migração única)

Novas tabelas:
- `public.teams` — `id uuid pk`, `name text not null`, `created_at`, `updated_at`.
- `public.team_members` — `team_id uuid fk teams(id) on delete cascade`, `user_id uuid fk profiles(id) on delete cascade`, PK composta `(team_id, user_id)`, `created_at`.

Ajuste em `clients`:
- Adicionar `team_id uuid null references public.teams(id) on delete set null`.

GRANTs + RLS (padrão do projeto):
- `teams` e `team_members`: SELECT para `authenticated`; INSERT/UPDATE/DELETE restrito a `is_manager(auth.uid())`. `service_role` full.
- Trigger `update_updated_at` em `teams`.

Migração de dados (best-effort, sem perder informação):
- Para cada `client_teams` marcado `is_default = true`, criar um `teams` com o mesmo nome (prefixado com o nome do cliente para evitar colisão) e copiar os membros correspondentes de `client_team_members` para `team_members`.
- Popular `clients.team_id` com o time recém-criado.
- Clientes sem equipe padrão ficam com `team_id = null`.

Legado: manter as tabelas `client_teams` / `client_team_members` por ora (não referenciadas pela nova UI) para permitir rollback. Remoção posterior em migração separada, após validação.

## 2. Front-end — menu e telas

`src/routes/_app.tsx`:
- Renomear o item **"Squad"** do grupo Squad para **"Times"** (rota continua `/squad` para evitar quebra de bookmarks; label atualizado).

Nova UI de Times em `src/routes/_app/squad.tsx` (substitui o uso de `TeamsPanel`):
- CRUD simples de times globais (sem seletor de cliente):
  - Listagem em cards/linhas com nome, contagem de membros, ações editar/excluir.
  - Diálogo "Novo/editar time": campo `name` + multi-select de membros (a partir de `profiles`, mesmos filtros já usados no `TeamsPanel`).
  - Persistência: upsert em `teams` + diff em `team_members` (insert dos novos, delete dos removidos).
- Gate: `isManager` (mesmo comportamento atual).

`src/components/squad/TeamsPanel.tsx`: remover (não é mais referenciado).

## 3. Cadastro de Clientes

`src/routes/_app/clientes-area.tsx` (aba "Clientes", formulário de criar/editar):
- Adicionar campo `Select` **"Time responsável"** listando `teams` (com opção "— Nenhum —").
- Persistir `team_id` no insert/update de `clients`.
- Mostrar o nome do time na tabela/listagem de clientes.

## 4. Automação em Nova Demanda

`src/routes/_app/projects.tsx` (formulário de demanda):
- Remover as queries `client_teams_for_project` e `client_team_members_for_team` e o seletor de equipe por cliente (o time agora vem do cliente automaticamente).
- Ao selecionar um `client_id`:
  1. Buscar `clients.team_id`.
  2. Se houver, buscar `team_members.user_id` desse time.
  3. Pré-preencher o state `assignees` com esses usuários (papel/role_id vazio, como hoje).
- Regras:
  - Só sobrescreve o array quando ele está vazio ou quando o cliente muda de fato (não apaga seleção manual já feita para o mesmo cliente).
  - O botão "+ adicionar responsável" e a remoção individual continuam funcionando (nenhum campo é desabilitado).
- Ao editar demanda existente, preservar os assignees já salvos; a automação só dispara em troca de cliente.

O campo `projects.team_id` existente pode continuar sendo gravado (opcional, refletindo o time do cliente no momento da criação) para histórico; sem UI dedicada.

## 5. Limpeza e verificação

- Remover imports órfãos após a exclusão do `TeamsPanel`.
- Rodar typecheck; conferir preview: criar time, associar a cliente, criar demanda e validar auto-preenchimento + edição manual.
- Console/network limpos em `/squad`, `/clientes-area` e `/projects`.

## Detalhes técnicos

- Sem alteração no fluxo de permissões (`isManager` continua sendo a barreira para gerenciar times e vincular clientes).
- Tipos regenerados automaticamente após a migração aprovada; código que usa `(supabase.from as any)("client_teams")` será removido junto com o `TeamsPanel`.
- Nome da rota permanece `/squad` para não invalidar o menu/rotas geradas; apenas o label muda para "Times".
