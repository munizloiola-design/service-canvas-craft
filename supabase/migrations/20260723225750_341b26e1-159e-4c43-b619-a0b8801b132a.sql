
-- ============ Limpeza de órfãos ============
DELETE FROM public.client_briefings   WHERE client_id  NOT IN (SELECT id FROM public.clients);
DELETE FROM public.client_users       WHERE user_id    NOT IN (SELECT id FROM auth.users);
DELETE FROM public.project_assignees  WHERE user_id    NOT IN (SELECT id FROM auth.users);
DELETE FROM public.project_comments   WHERE project_id NOT IN (SELECT id FROM public.projects)
                                         OR author_id  NOT IN (SELECT id FROM auth.users);
DELETE FROM public.team_private_notes WHERE user_id    NOT IN (SELECT id FROM auth.users);
DELETE FROM public.user_functions     WHERE user_id    NOT IN (SELECT id FROM auth.users);
DELETE FROM public.dashboard_widgets  WHERE user_id    NOT IN (SELECT id FROM auth.users);
DELETE FROM public.diguinho_messages  WHERE user_id    NOT IN (SELECT id FROM auth.users);

UPDATE public.budget_simulations SET created_by  = NULL WHERE created_by  IS NOT NULL AND created_by  NOT IN (SELECT id FROM auth.users);
UPDATE public.equipments         SET created_by  = NULL WHERE created_by  IS NOT NULL AND created_by  NOT IN (SELECT id FROM auth.users);
UPDATE public.financial_entries  SET created_by  = NULL WHERE created_by  IS NOT NULL AND created_by  NOT IN (SELECT id FROM auth.users);
UPDATE public.text_snippets      SET created_by  = NULL WHERE created_by  IS NOT NULL AND created_by  NOT IN (SELECT id FROM auth.users);
UPDATE public.ticket_requests    SET reviewed_by = NULL WHERE reviewed_by IS NOT NULL AND reviewed_by NOT IN (SELECT id FROM auth.users);

-- ============ FKs faltantes (CASCADE) ============
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
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- author_id é NOT NULL → CASCADE (apagar comentários se o autor for removido)
ALTER TABLE public.project_comments
  ADD CONSTRAINT project_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;

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

-- ============ FKs faltantes (SET NULL) ============
ALTER TABLE public.budget_simulations
  ADD CONSTRAINT budget_simulations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.equipments
  ADD CONSTRAINT equipments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.financial_entries
  ADD CONSTRAINT financial_entries_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.text_snippets
  ADD CONSTRAINT text_snippets_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.ticket_requests
  ADD CONSTRAINT ticket_requests_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============ Ajuste ON DELETE ============
ALTER TABLE public.pending_registrations
  DROP CONSTRAINT IF EXISTS pending_registrations_reviewed_by_fkey;
ALTER TABLE public.pending_registrations
  ADD  CONSTRAINT pending_registrations_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============ RLS — corrigir escalada de privilégio ============
DROP POLICY IF EXISTS assignees_insert_mgr ON public.project_assignees;
DROP POLICY IF EXISTS pa_no_clients_insert ON public.project_assignees;
CREATE POLICY assignees_insert_mgr ON public.project_assignees
  FOR INSERT TO authenticated
  WITH CHECK (is_manager(auth.uid()) AND NOT is_client_profile(user_id));

DROP POLICY IF EXISTS team_members_insert_mgr ON public.team_members;
DROP POLICY IF EXISTS tm_no_clients_insert    ON public.team_members;
CREATE POLICY team_members_insert_mgr ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (is_manager(auth.uid()) AND NOT is_client_profile(user_id));
