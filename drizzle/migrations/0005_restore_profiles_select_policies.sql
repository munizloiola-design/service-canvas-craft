CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_select_internal ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()) AND public.is_internal_user(id));

CREATE POLICY profiles_select_managers ON public.profiles
  FOR SELECT
  USING (
    public.is_manager(auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.client_users cu WHERE cu.user_id = auth.uid())
  );