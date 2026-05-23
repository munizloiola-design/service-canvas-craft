
-- 1. budget_simulations: restrict SELECT
DROP POLICY IF EXISTS bs_select ON public.budget_simulations;
CREATE POLICY bs_select ON public.budget_simulations
  FOR SELECT TO authenticated
  USING (is_manager(auth.uid()) OR created_by = auth.uid());

-- 2. financial_entries: restrict SELECT to managers
DROP POLICY IF EXISTS fe_select ON public.financial_entries;
CREATE POLICY fe_select ON public.financial_entries
  FOR SELECT TO authenticated
  USING (is_manager(auth.uid()));

-- 3. fixed_costs / recurring_incomes
DROP POLICY IF EXISTS fc_select ON public.fixed_costs;
CREATE POLICY fc_select ON public.fixed_costs
  FOR SELECT TO authenticated
  USING (is_manager(auth.uid()));

DROP POLICY IF EXISTS ri_select ON public.recurring_incomes;
CREATE POLICY ri_select ON public.recurring_incomes
  FOR SELECT TO authenticated
  USING (is_manager(auth.uid()));

-- 4. profiles: restrict SELECT
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY profiles_select_managers ON public.profiles
  FOR SELECT TO authenticated
  USING (is_manager(auth.uid()));

-- 5. team_private_notes: allow users to manage own notes
CREATE POLICY tpn_owner_select ON public.team_private_notes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY tpn_owner_insert ON public.team_private_notes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY tpn_owner_update ON public.team_private_notes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY tpn_owner_delete ON public.team_private_notes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 6. Storage: project-files restricted by project membership
DROP POLICY IF EXISTS project_files_select_auth ON storage.objects;
DROP POLICY IF EXISTS project_files_insert_auth ON storage.objects;

CREATE POLICY project_files_select_scoped ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-files'
    AND (
      is_manager(auth.uid())
      OR public.is_project_assignee(
           auth.uid(),
           ((storage.foldername(name))[1])::uuid
         )
    )
  );

CREATE POLICY project_files_insert_scoped ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-files'
    AND (
      is_manager(auth.uid())
      OR public.is_project_assignee(
           auth.uid(),
           ((storage.foldername(name))[1])::uuid
         )
    )
  );

-- 7. Fix mutable search_path on email queue helpers
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = pgmq, public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = pgmq, public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = pgmq, public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = pgmq, public;

-- 8. Realtime: restrict project_comments channel subscriptions
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rt_project_comments_select ON realtime.messages;
CREATE POLICY rt_project_comments_select ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    (realtime.topic() NOT LIKE 'project_comments:%')
    OR is_manager(auth.uid())
    OR public.is_project_assignee(
         auth.uid(),
         NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
       )
  );
