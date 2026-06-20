
-- 1) Restrict ticket-attachments uploads
DROP POLICY IF EXISTS ticket_attachments_public_upload ON storage.objects;

CREATE POLICY ticket_attachments_public_upload
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'ticket-attachments'
  AND (storage.foldername(name))[1] = 'public'
  AND coalesce((metadata->>'size')::bigint, 0) <= 26214400
  AND (
    coalesce(metadata->>'mimetype', '') = ''
    OR metadata->>'mimetype' LIKE 'image/%'
    OR metadata->>'mimetype' LIKE 'video/%'
    OR metadata->>'mimetype' LIKE 'audio/%'
    OR metadata->>'mimetype' LIKE 'text/%'
    OR metadata->>'mimetype' IN (
      'application/pdf',
      'application/zip',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/octet-stream'
    )
  )
);

-- 2) Tighten profiles SELECT to exclude client-portal users from reading other rows.
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_select_managers ON public.profiles;
CREATE POLICY profiles_select_managers
ON public.profiles
FOR SELECT
USING (
  is_manager(auth.uid())
  AND NOT EXISTS (SELECT 1 FROM public.client_users cu WHERE cu.user_id = auth.uid())
);
