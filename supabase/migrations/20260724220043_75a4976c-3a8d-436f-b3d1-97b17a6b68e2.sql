
-- financial_settings: managers only
DROP POLICY IF EXISTS fs_select ON public.financial_settings;
CREATE POLICY fs_select ON public.financial_settings FOR SELECT TO authenticated
  USING (public.is_manager(auth.uid()));

-- equipments: managers only
DROP POLICY IF EXISTS equipments_select ON public.equipments;
CREATE POLICY equipments_select ON public.equipments FOR SELECT TO authenticated
  USING (public.is_manager(auth.uid()));

-- role_permissions: managers only
DROP POLICY IF EXISTS rp_select ON public.role_permissions;
CREATE POLICY rp_select ON public.role_permissions FOR SELECT TO authenticated
  USING (public.is_manager(auth.uid()));

-- project_assignees: managers, the assigned user themselves, or users who can view the project
DROP POLICY IF EXISTS assignees_select ON public.project_assignees;
CREATE POLICY assignees_select ON public.project_assignees FOR SELECT TO authenticated
  USING (
    public.is_manager(auth.uid())
    OR user_id = auth.uid()
    OR public.can_view_project(auth.uid(), project_id)
  );
