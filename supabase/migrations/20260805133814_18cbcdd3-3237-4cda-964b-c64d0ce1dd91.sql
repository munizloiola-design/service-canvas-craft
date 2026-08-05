ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS caption text;

CREATE OR REPLACE FUNCTION public.has_menu_access(_uid uuid, _menu_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_specialties us
    JOIN public.provider_specialties ps ON ps.id = us.specialty_id
    JOIN public.area_menu_visibility amv ON amv.area_id = ps.area_id
    WHERE us.user_id = _uid
      AND amv.menu_key = _menu_key
  )
$$;

DROP POLICY IF EXISTS projects_insert_managers ON public.projects;
CREATE POLICY projects_insert_access
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (public.has_menu_access(auth.uid(), '/projects'));

DROP POLICY IF EXISTS projects_update_managers ON public.projects;
CREATE POLICY projects_update_access
ON public.projects
FOR UPDATE
TO authenticated
USING (
  public.has_menu_access(auth.uid(), '/projects')
  OR public.is_project_assignee(auth.uid(), id)
)
WITH CHECK (
  public.has_menu_access(auth.uid(), '/projects')
  OR public.is_project_assignee(auth.uid(), id)
);

DROP POLICY IF EXISTS assignees_insert_mgr ON public.project_assignees;
CREATE POLICY assignees_insert_access
ON public.project_assignees
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_menu_access(auth.uid(), '/projects')
  AND NOT public.is_client_profile(user_id)
);

DROP POLICY IF EXISTS assignees_update_mgr ON public.project_assignees;
CREATE POLICY assignees_update_access
ON public.project_assignees
FOR UPDATE
TO authenticated
USING (public.has_menu_access(auth.uid(), '/projects'))
WITH CHECK (public.has_menu_access(auth.uid(), '/projects'));

DROP POLICY IF EXISTS assignees_delete_mgr ON public.project_assignees;
CREATE POLICY assignees_delete_access
ON public.project_assignees
FOR DELETE
TO authenticated
USING (public.has_menu_access(auth.uid(), '/projects'));

GRANT EXECUTE ON FUNCTION public.has_menu_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_menu_access(uuid, text) TO service_role;