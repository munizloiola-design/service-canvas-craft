DROP VIEW IF EXISTS public.internal_directory;

CREATE POLICY profiles_select_internal ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()) AND public.is_internal_user(id));

REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (id, full_name, job_title, avatar_url, phone, created_at, updated_at)
  ON public.profiles TO authenticated;

DROP VIEW IF EXISTS public.internal_profiles;

CREATE VIEW public.internal_profiles
WITH (security_invoker = true) AS
SELECT p.id, p.full_name, p.job_title, p.avatar_url, p.phone, p.created_at, p.updated_at
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'cliente'::app_role)
  AND NOT EXISTS (SELECT 1 FROM public.client_users cu WHERE cu.user_id = p.id);

GRANT SELECT ON public.internal_profiles TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.team_private_profiles()
RETURNS TABLE (
  id uuid,
  hourly_cost numeric,
  commission_pct numeric,
  birth_date date,
  document text,
  address text,
  emergency_contact text,
  start_date date,
  contract_type text,
  password_setup_link text,
  password_setup_expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.hourly_cost, p.commission_pct, p.birth_date, p.document, p.address,
         p.emergency_contact, p.start_date, p.contract_type,
         p.password_setup_link, p.password_setup_expires_at
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND (p.id = auth.uid() OR public.is_manager(auth.uid()))
$$;

REVOKE ALL ON FUNCTION public.team_private_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_private_profiles() TO authenticated, service_role;