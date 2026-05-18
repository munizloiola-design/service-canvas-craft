
-- role_permissions: permitir admin_master
DROP POLICY IF EXISTS "rp_insert" ON public.role_permissions;
DROP POLICY IF EXISTS "rp_update" ON public.role_permissions;
DROP POLICY IF EXISTS "rp_delete" ON public.role_permissions;

CREATE POLICY "rp_insert" ON public.role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_master(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "rp_update" ON public.role_permissions
  FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "rp_delete" ON public.role_permissions
  FOR DELETE TO authenticated
  USING (public.is_master(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- profiles: master pode atualizar qualquer perfil
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- projects: usar is_manager (já inclui master)
DROP POLICY IF EXISTS "projects_insert_managers" ON public.projects;
DROP POLICY IF EXISTS "projects_update_managers" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_managers" ON public.projects;

CREATE POLICY "projects_insert_managers" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "projects_update_managers" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.is_manager(auth.uid()));

CREATE POLICY "projects_delete_managers" ON public.projects
  FOR DELETE TO authenticated
  USING (public.is_manager(auth.uid()));

-- project_attachments delete: incluir master
DROP POLICY IF EXISTS "attachments_delete_managers" ON public.project_attachments;
CREATE POLICY "attachments_delete_managers" ON public.project_attachments
  FOR DELETE TO authenticated
  USING (
    public.is_manager(auth.uid())
    OR uploaded_by = auth.uid()
  );
