-- Fix 1: Restrict clients SELECT to managers + client-portal users for their own clients
DROP POLICY IF EXISTS clients_select_auth ON public.clients;

CREATE POLICY clients_select_mgr ON public.clients
  FOR SELECT TO authenticated
  USING (is_manager(auth.uid()));

-- clients_select_client policy (has_client_access) already exists for client-portal users

-- Fix 2: Restrict financial-receipts SELECT to managers
DROP POLICY IF EXISTS receipts_select_auth ON storage.objects;
CREATE POLICY receipts_select_mgr ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'financial-receipts' AND is_manager(auth.uid()));

-- Fix 3: Restrict financial-receipts INSERT to managers
DROP POLICY IF EXISTS receipts_insert_auth ON storage.objects;
CREATE POLICY receipts_insert_mgr ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'financial-receipts' AND is_manager(auth.uid()));

-- Fix 4: Add explicit UPDATE policy for project-files bucket
CREATE POLICY project_files_update_scoped ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'project-files' AND (is_manager(auth.uid()) OR is_project_assignee(auth.uid(), ((storage.foldername(name))[1])::uuid)))
  WITH CHECK (bucket_id = 'project-files' AND (is_manager(auth.uid()) OR is_project_assignee(auth.uid(), ((storage.foldername(name))[1])::uuid)));
