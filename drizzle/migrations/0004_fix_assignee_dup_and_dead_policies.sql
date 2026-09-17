CREATE UNIQUE INDEX IF NOT EXISTS project_assignees_project_user_norole_key
  ON public.project_assignees (project_id, user_id)
  WHERE role_id IS NULL;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_internal ON public.profiles;
DROP POLICY IF EXISTS profiles_select_managers ON public.profiles;