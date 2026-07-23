CREATE OR REPLACE FUNCTION public.can_view_project(_uid uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
      AND (
        public.is_manager(_uid)
        OR p.assigned_to = _uid
        OR EXISTS (SELECT 1 FROM public.project_assignees pa WHERE pa.project_id = p.id AND pa.user_id = _uid)
        OR (p.team_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = p.team_id AND tm.user_id = _uid))
        OR EXISTS (
          SELECT 1
          FROM public.project_assignees pa
          JOIN public.user_functions uf ON uf.function_id = pa.role_id
          WHERE pa.project_id = p.id AND uf.user_id = _uid
        )
      )
  )
$$;

DROP POLICY IF EXISTS "projects_select_scoped" ON public.projects;

CREATE POLICY "projects_select_scoped" ON public.projects
FOR SELECT TO authenticated
USING (public.can_view_project(auth.uid(), id));