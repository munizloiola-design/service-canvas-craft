CREATE OR REPLACE FUNCTION public.budget_hourly_costs()
RETURNS TABLE(id uuid, hourly_cost numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.hourly_cost
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND public.is_internal_user(auth.uid())
    AND public.is_internal_user(p.id)
    AND (public.is_manager(auth.uid()) OR public.has_menu_access(auth.uid(), '/orcamento'))
$$;

REVOKE EXECUTE ON FUNCTION public.budget_hourly_costs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.budget_hourly_costs() TO authenticated, service_role;
