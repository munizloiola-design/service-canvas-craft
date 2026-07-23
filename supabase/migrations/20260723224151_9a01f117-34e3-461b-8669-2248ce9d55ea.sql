-- View that excludes client-role users and users linked in client_users
CREATE OR REPLACE VIEW public.internal_profiles
WITH (security_invoker = true) AS
SELECT p.*
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'cliente'::app_role)
  AND NOT EXISTS (SELECT 1 FROM public.client_users cu WHERE cu.user_id = p.id);

GRANT SELECT ON public.internal_profiles TO authenticated;

-- Prevent adding client users into internal team structures
CREATE OR REPLACE FUNCTION public.is_client_profile(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'cliente'::app_role)
      OR EXISTS (SELECT 1 FROM public.client_users WHERE user_id = _uid)
$$;

-- Block insert of clients into team_members / project_assignees / project_roles
DROP POLICY IF EXISTS "tm_no_clients_insert" ON public.team_members;
CREATE POLICY "tm_no_clients_insert" ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_client_profile(user_id));

DROP POLICY IF EXISTS "pa_no_clients_insert" ON public.project_assignees;
CREATE POLICY "pa_no_clients_insert" ON public.project_assignees
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_client_profile(user_id));