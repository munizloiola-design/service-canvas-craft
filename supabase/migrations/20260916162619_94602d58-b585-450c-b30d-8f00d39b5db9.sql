DROP POLICY IF EXISTS profiles_select_internal ON public.profiles;

CREATE OR REPLACE VIEW public.internal_directory
WITH (security_invoker = false) AS
SELECT p.id, p.full_name, p.job_title, p.avatar_url, p.phone
FROM public.profiles p
WHERE public.is_internal_user(auth.uid())
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'cliente'::app_role)
  AND NOT EXISTS (SELECT 1 FROM public.client_users cu WHERE cu.user_id = p.id);

REVOKE ALL ON public.internal_directory FROM PUBLIC, anon;
GRANT SELECT ON public.internal_directory TO authenticated;
GRANT SELECT ON public.internal_directory TO service_role;