CREATE OR REPLACE FUNCTION public.is_internal_user(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.client_users cu WHERE cu.user_id = _uid)
     AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _uid AND ur.role = 'cliente'::app_role)
$$;

CREATE POLICY clients_select_internal ON public.clients
FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

CREATE POLICY profiles_select_internal ON public.profiles
FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()) AND public.is_internal_user(id));