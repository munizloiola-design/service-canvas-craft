
-- Rank helper
CREATE OR REPLACE FUNCTION public.role_rank(_role app_role)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'admin_master'::app_role THEN 4
    WHEN 'admin'::app_role THEN 3
    WHEN 'gerente'::app_role THEN 2
    WHEN 'membro'::app_role THEN 1
    WHEN 'cliente'::app_role THEN 0
    ELSE -1 END
$$;

-- Highest rank a user has
CREATE OR REPLACE FUNCTION public.user_max_rank(_uid uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(public.role_rank(role)), -1)
  FROM public.user_roles WHERE user_id = _uid
$$;

-- Can actor manage (assign/remove) the given role row for the given target user?
-- Actor's max rank must be strictly greater than:
--   * the role being touched, AND
--   * the target user's current max rank (so admin can't demote another admin).
CREATE OR REPLACE FUNCTION public.can_manage_user_role(_actor uuid, _target uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.user_max_rank(_actor) > public.role_rank(_role)
    AND public.user_max_rank(_actor) > public.user_max_rank(_target)
$$;

-- Replace user_roles write policies
DROP POLICY IF EXISTS roles_admin_insert ON public.user_roles;
DROP POLICY IF EXISTS roles_admin_update ON public.user_roles;
DROP POLICY IF EXISTS roles_admin_delete ON public.user_roles;

CREATE POLICY roles_hier_insert ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_user_role(auth.uid(), user_id, role));

CREATE POLICY roles_hier_update ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.can_manage_user_role(auth.uid(), user_id, role))
  WITH CHECK (public.can_manage_user_role(auth.uid(), user_id, role));

CREATE POLICY roles_hier_delete ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.can_manage_user_role(auth.uid(), user_id, role));
