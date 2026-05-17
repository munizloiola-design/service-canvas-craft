# Plano: Níveis de acesso, subfunções e Equipe expandida

## 1. Hierarquia de papéis

Criar novo papel `admin_master` no enum `app_role`, acima de `admin`.

```
admin_master  →  acesso total + anotações privadas + config de visibilidade
admin         →  como hoje (gestão geral, sem anotações privadas)
gerente       →  como hoje
membro        →  colaborador (ver item 2)
cliente       →  como hoje (portal)
```

- Migração: `ALTER TYPE app_role ADD VALUE 'admin_master'`
- O primeiro usuário do sistema vira `admin_master` automaticamente (ajustar `handle_new_user`).
- Funções helper: `is_master(uid)`, atualizar `is_manager` para incluir master.
- Tela de Equipe ganha botão "Promover a Admin Master" (visível só para masters).

## 2. Subfunções de colaborador

Nova tabela `collaborator_functions` com os tipos fixos:
Social Media, Designer, Motion Designer, Videomaker, Editor de Vídeo, Fotógrafo, Revisor, Redator.

Nova tabela `user_functions (user_id, function_id)` — colaborador pode ter 1+ funções.

### Acesso a demandas (tickets/projetos)

- **Colaborador só vê demandas onde está em `project_assignees`** (já existe a tabela).
- Atualizar RLS de `projects`: SELECT para `membro` exige existir linha em `project_assignees` com aquele user_id.
- Mesma regra para `project_attachments`, `project_transitions`.

### Visibilidade de campos por subfunção

Nova tabela `function_field_visibility`:
```
function_id | field_key | visible (bool)
```
Campos cobertos: `budget`, `client_id`, `due_date`, `post_date`, `priority`, `description`, `notes`, `reference_links`, `deliverable_path`, `client_feedback`, `media_type`.

Nova tela **Permissões → aba "Visibilidade por função"**: matriz funções × campos com checkboxes (só admin_master edita).

Frontend: hook `useVisibleProjectFields()` filtra os campos exibidos no card/detalhe da demanda conforme as funções do usuário logado. Backend não retorna campos ocultos via server function dedicada para colaboradores.

## 3. Equipe — métricas + ficha + anotações privadas

Página `/equipe` (renomeia atual `team.tsx`) reorganizada em 3 áreas por membro:

### a) Métricas (visível a admins e gerentes)

Calculadas via server function a partir de `projects` + `project_transitions`:
- **Atrasadas**: assignee + `due_date < hoje` + status não-final
- **Ativas**: assignee + status não-final + não atrasada
- **Pendentes**: assignee + status inicial (aguardando começar)
- **Tempo médio por status**: diferença entre `project_transitions` consecutivas, agrupada por `to_status_id`, média em horas

### b) Ficha de cadastro (admin_master edita; o próprio usuário vê)

Estende `profiles` com: `birth_date`, `document` (CPF), `address`, `emergency_contact`, `start_date`, `contract_type`.

### c) Anotações privadas (admin_master only)

Nova tabela `team_private_notes (user_id, content, updated_at, updated_by)`.
RLS: SELECT/INSERT/UPDATE/DELETE apenas para `is_master(auth.uid())`.
Editor markdown simples, histórico via `updated_at`.

## 4. Facebook publishing

**Adiado** conforme decisão. Sem mudanças neste plano.

## 5. Itens técnicos

```text
Migrações Supabase:
  - ALTER TYPE app_role ADD VALUE 'admin_master'
  - função is_master(uid)
  - tabelas: collaborator_functions, user_functions,
            function_field_visibility, team_private_notes
  - ALTER TABLE profiles ADD colunas de ficha
  - atualizar RLS de projects/attachments/transitions
  - seed das 8 subfunções

Frontend:
  - src/lib/auth-context.tsx → adicionar isMaster
  - src/lib/permissions.tsx → expor visibleFields()
  - src/routes/_app/permissoes.tsx → nova aba "Visibilidade"
  - src/routes/_app/team.tsx → reorganização (métricas, ficha, anotações)
  - novo componente FieldGuard para esconder campos em projects.tsx
  - server fn: getTeamMetrics, getAvgTimePerStatus

Menu lateral:
  - "Permissões" só para admin_master/admin
  - Equipe ganha sub-rotas: Visão geral / Métricas / Anotações (master)
```

## Ordem de execução

1. Migração (papel + tabelas + RLS) — exige aprovação
2. Auth context + helpers (`isMaster`, `useVisibleProjectFields`)
3. Tela Permissões: aba Visibilidade
4. Tela Equipe: métricas + ficha + anotações privadas
5. Aplicar `FieldGuard` nas telas de demandas/tickets

Aprovar para eu começar pela migração?