
-- 1) Admin master bypass on role management
CREATE OR REPLACE FUNCTION public.can_manage_user_role(_actor uuid, _target uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_master(_actor)
    OR (
      public.user_max_rank(_actor) > public.role_rank(_role)
      AND public.user_max_rank(_actor) > public.user_max_rank(_target)
    )
$$;

-- 2) Avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3) Storage policies
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_mgr_insert" ON storage.objects;
CREATE POLICY "avatars_mgr_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND public.is_manager(auth.uid()));

DROP POLICY IF EXISTS "avatars_mgr_update" ON storage.objects;
CREATE POLICY "avatars_mgr_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND public.is_manager(auth.uid()));

DROP POLICY IF EXISTS "avatars_mgr_delete" ON storage.objects;
CREATE POLICY "avatars_mgr_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND public.is_manager(auth.uid()));
