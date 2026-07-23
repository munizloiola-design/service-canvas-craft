
DROP POLICY IF EXISTS transitions_insert ON public.project_transitions;
CREATE POLICY transitions_insert ON public.project_transitions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = changed_by
    AND (public.is_manager(auth.uid()) OR public.is_project_assignee(auth.uid(), project_id))
  );

DROP POLICY IF EXISTS roles_select_all ON public.user_roles;
CREATE POLICY roles_select_own_or_manager ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_manager(auth.uid()));
