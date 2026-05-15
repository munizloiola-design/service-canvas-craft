
DROP POLICY IF EXISTS media_types_select_auth ON public.media_types;

CREATE POLICY media_types_select_public ON public.media_types
  FOR SELECT TO anon, authenticated
  USING (true);
