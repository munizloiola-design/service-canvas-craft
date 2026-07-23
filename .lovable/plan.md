
# Relatório de Auditoria de Integridade

Auditei o schema real via consultas ao banco (`pg_constraint`, `pg_policies`, `pg_class`), joins do front-end via `rg` em `src/`, e as políticas ativas. Segue o que encontrei e o que proponho corrigir.

## 1. Chaves Estrangeiras (FKs)

Auditadas 42 FKs em `public`. Grande maioria está correta (CASCADE onde faz sentido em tabelas-filhas, SET NULL em referências opcionais). Achei estes problemas:

### 1.1 Colunas de relacionamento SEM FK (integridade não garantida)
Estas colunas guardam UUIDs de outras tabelas mas não têm constraint — permitem "linkar" IDs inexistentes e não se limpam quando o registro-pai é apagado:

| Tabela | Coluna | Deve referenciar | ON DELETE |
|---|---|---|---|
| client_briefings | client_id | clients(id) | CASCADE |
| client_users | user_id | auth.users(id) | CASCADE |
| project_assignees | user_id | auth.users(id) | CASCADE |
| project_comments | project_id | projects(id) | CASCADE |
| project_comments | author_id | auth.users(id) | SET NULL |
| team_private_notes | user_id | auth.users(id) | CASCADE |
| user_functions | user_id | auth.users(id) | CASCADE |
| dashboard_widgets | user_id | auth.users(id) | CASCADE |
| diguinho_messages | user_id | auth.users(id) | CASCADE |
| budget_simulations | created_by | auth.users(id) | SET NULL |
| equipments | created_by | auth.users(id) | SET NULL |
| financial_entries | created_by | auth.users(id) | SET NULL |
| text_snippets | created_by | auth.users(id) | SET NULL |
| ticket_requests | reviewed_by | auth.users(id) | SET NULL |

`time_logs_with_duration` é uma view — sem FK esperada, ignorar.

### 1.2 ON DELETE inadequado
- `pending_registrations.reviewed_by → auth.users` está `NO ACTION` → deve ser `SET NULL` (senão apagar admin trava).

### 1.3 FK obsoleta
- `clients.team_id → teams(id)`. Após migração para `client_teams`, o sistema usa `projects.team_id → client_teams(id)`. Confirmar com você antes de mexer: manter para times internos ou remigrar para `client_teams`.

## 2. Row Level Security

RLS está habilitado em todas as 51 tabelas. Sem risco de recursão infinita (todos os helpers — `is_manager`, `has_client_access`, `is_project_assignee`, `has_role` — são SECURITY DEFINER com `search_path=public`, então não reentram nas policies). Porém há dois problemas sérios de **política permissiva duplicada**:

### 2.1 Escalada de acesso em `project_assignees`
Existem duas policies de INSERT: `assignees_insert_mgr` (só gerente) **e** `pa_no_clients_insert` (`NOT is_client_profile(user_id)`). Policies permissivas se somam em OR → qualquer usuário autenticado não-cliente pode inserir em `project_assignees`, ou seja, se auto-adicionar a qualquer projeto. Corrigir combinando as duas em uma única regra restritiva.

### 2.2 Mesmo padrão em `team_members`
`team_members_insert_mgr` + `tm_no_clients_insert` → qualquer usuário não-cliente pode se auto-adicionar a qualquer time. Mesma correção.

### 2.3 Observações menores (não corrigir sem confirmação)
- `projects_update_assignee` permite ao responsável atualizar qualquer coluna (inclusive `client_id`, `status_id`). Se a intenção era só drag-and-drop de datas/status, deveria virar `WITH CHECK` restrito ou usar um RPC.
- `time_logs_own_insert` não valida se o usuário pertence ao projeto. Aceitável se front garantir; comentado apenas.

## 3. Queries do Front-end (TanStack Query)

Rodei `rg` em `src/` procurando joins `tabela(coluna)`. Encontrei apenas:
- `financial_entries → projects(title), clients(name)` ✓ (FKs existem)
- `recurring_incomes → clients(name)` ✓
- `projects → workflow_statuses(name, color)` (em `clientes.tsx:674`) ✓

Todos batem com FKs reais; nenhum join quebrado ou nome de coluna divergente.

## 4. Sincronia de Tipos (`types.ts`)

`src/integrations/supabase/types.ts` é regenerado automaticamente após cada migration aprovada. Uma vez que a migration da seção 1 rodar, os tipos serão atualizados na mesma passagem. Nenhuma edição manual em `types.ts` (é proibido pelo guia). Após aprovar, verifico se algum `.tsx` precisa se ajustar aos novos campos nullable/FK (não deve, pois só adiciono constraints, não colunas).

---

## Correções propostas (SQL — uma migration)

```sql
-- 1) FKs faltantes
ALTER TABLE public.client_briefings
  ADD CONSTRAINT client_briefings_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.client_users
  ADD CONSTRAINT client_users_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.project_assignees
  ADD CONSTRAINT project_assignees_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.project_comments
  ADD CONSTRAINT project_comments_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD CONSTRAINT project_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.team_private_notes
  ADD CONSTRAINT team_private_notes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_functions
  ADD CONSTRAINT user_functions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.dashboard_widgets
  ADD CONSTRAINT dashboard_widgets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.diguinho_messages
  ADD CONSTRAINT diguinho_messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- created_by / reviewed_by → SET NULL (com pré-limpeza p/ IDs órfãos)
UPDATE public.budget_simulations SET created_by = NULL WHERE created_by NOT IN (SELECT id FROM auth.users);
UPDATE public.equipments         SET created_by = NULL WHERE created_by NOT IN (SELECT id FROM auth.users);
UPDATE public.financial_entries  SET created_by = NULL WHERE created_by NOT IN (SELECT id FROM auth.users);
UPDATE public.text_snippets      SET created_by = NULL WHERE created_by NOT IN (SELECT id FROM auth.users);
UPDATE public.ticket_requests    SET reviewed_by = NULL WHERE reviewed_by NOT IN (SELECT id FROM auth.users);

ALTER TABLE public.budget_simulations ADD CONSTRAINT budget_simulations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.equipments         ADD CONSTRAINT equipments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.financial_entries  ADD CONSTRAINT financial_entries_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.text_snippets      ADD CONSTRAINT text_snippets_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.ticket_requests    ADD CONSTRAINT ticket_requests_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2) ON DELETE inadequado
ALTER TABLE public.pending_registrations
  DROP CONSTRAINT pending_registrations_reviewed_by_fkey,
  ADD  CONSTRAINT pending_registrations_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3) RLS — fechar auto-inserção em project_assignees e team_members
DROP POLICY IF EXISTS assignees_insert_mgr  ON public.project_assignees;
DROP POLICY IF EXISTS pa_no_clients_insert  ON public.project_assignees;
CREATE POLICY assignees_insert_mgr ON public.project_assignees
  FOR INSERT TO authenticated
  WITH CHECK (is_manager(auth.uid()) AND NOT is_client_profile(user_id));

DROP POLICY IF EXISTS team_members_insert_mgr ON public.team_members;
DROP POLICY IF EXISTS tm_no_clients_insert    ON public.team_members;
CREATE POLICY team_members_insert_mgr ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (is_manager(auth.uid()) AND NOT is_client_profile(user_id));
```

### Decisões que preciso confirmar antes de rodar
1. Mantenho `clients.team_id → teams(id)` como está (times internos), ou migro para `client_teams`?
2. Aperto `projects_update_assignee` (assignee só edita datas/status via RPC), ou deixo como está?

Sem mudanças de código front-end são necessárias — só migration + regeneração automática dos tipos. Se preferir, posso subir a correção sem esperar as respostas de 1 e 2, mantendo o comportamento atual desses dois pontos.
