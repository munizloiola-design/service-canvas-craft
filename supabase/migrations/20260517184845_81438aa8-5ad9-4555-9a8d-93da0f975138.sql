-- 1. Add new role to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_master';

-- 2. Helper functions (use text cast to avoid same-tx enum reference issue)
CREATE OR REPLACE FUNCTION public.is_master(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role::text = 'admin_master'
  )
$$;

-- Update is_manager to include admin_master
CREATE OR REPLACE FUNCTION public.is_manager(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_master(_uid)
      OR public.has_role(_uid, 'admin'::app_role)
      OR public.has_role(_uid, 'gerente'::app_role)
$$;

-- 3. Update handle_new_user: first user becomes admin_master
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    (CASE WHEN is_first THEN 'admin_master' ELSE 'membro' END)::app_role
  );
  RETURN NEW;
END $$;

-- 4. Collaborator functions (subfunções)
CREATE TABLE IF NOT EXISTS public.collaborator_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.collaborator_functions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cf_select_auth ON public.collaborator_functions FOR SELECT TO authenticated USING (true);
CREATE POLICY cf_manage_master ON public.collaborator_functions FOR ALL TO authenticated
  USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

INSERT INTO public.collaborator_functions (key, name, sort_order) VALUES
  ('social_media', 'Social Media', 10),
  ('designer', 'Designer', 20),
  ('motion_designer', 'Motion Designer', 30),
  ('videomaker', 'Videomaker', 40),
  ('editor_video', 'Editor de Vídeo', 50),
  ('fotografo', 'Fotógrafo', 60),
  ('revisor', 'Revisor', 70),
  ('redator', 'Redator', 80)
ON CONFLICT (key) DO NOTHING;

-- 5. User <-> function mapping
CREATE TABLE IF NOT EXISTS public.user_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_id uuid NOT NULL REFERENCES public.collaborator_functions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, function_id)
);
ALTER TABLE public.user_functions ENABLE ROW LEVEL SECURITY;
CREATE POLICY uf_select_auth ON public.user_functions FOR SELECT TO authenticated USING (true);
CREATE POLICY uf_manage_master ON public.user_functions FOR ALL TO authenticated
  USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

-- 6. Field visibility per function
CREATE TABLE IF NOT EXISTS public.function_field_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id uuid NOT NULL REFERENCES public.collaborator_functions(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (function_id, field_key)
);
ALTER TABLE public.function_field_visibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY ffv_select_auth ON public.function_field_visibility FOR SELECT TO authenticated USING (true);
CREATE POLICY ffv_manage_master ON public.function_field_visibility FOR ALL TO authenticated
  USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

-- 7. Private team notes (master only)
CREATE TABLE IF NOT EXISTS public.team_private_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.team_private_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tpn_master_all ON public.team_private_notes FOR ALL TO authenticated
  USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

-- 8. Extra profile fields (employee info)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS document text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS emergency_contact text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS contract_type text;

-- 9. Tighten RLS: membros (colaboradores) only see assigned projects
-- Helper: is the user assigned to this project?
CREATE OR REPLACE FUNCTION public.is_project_assignee(_uid uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_assignees
    WHERE project_id = _project_id AND user_id = _uid
  ) OR EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = _project_id AND assigned_to = _uid
  )
$$;

-- Replace projects select policy
DROP POLICY IF EXISTS projects_select_all ON public.projects;
CREATE POLICY projects_select_scoped ON public.projects FOR SELECT TO authenticated
USING (
  public.is_manager(auth.uid())
  OR assigned_to = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.project_assignees pa
    WHERE pa.project_id = projects.id AND pa.user_id = auth.uid()
  )
);

-- Tighten attachments select
DROP POLICY IF EXISTS attachments_select_all ON public.project_attachments;
CREATE POLICY attachments_select_scoped ON public.project_attachments FOR SELECT TO authenticated
USING (
  public.is_manager(auth.uid())
  OR public.is_project_assignee(auth.uid(), project_id)
);

-- Tighten transitions select
DROP POLICY IF EXISTS transitions_select ON public.project_transitions;
CREATE POLICY transitions_select_scoped ON public.project_transitions FOR SELECT TO authenticated
USING (
  public.is_manager(auth.uid())
  OR public.is_project_assignee(auth.uid(), project_id)
);

-- 10. Seed default field visibility = true for all (function, field) combos
INSERT INTO public.function_field_visibility (function_id, field_key, visible)
SELECT cf.id, fk.field_key, true
FROM public.collaborator_functions cf
CROSS JOIN (VALUES
  ('budget'), ('client_id'), ('due_date'), ('post_date'),
  ('priority'), ('description'), ('notes'), ('reference_links'),
  ('deliverable_path'), ('client_feedback'), ('media_type')
) AS fk(field_key)
ON CONFLICT (function_id, field_key) DO NOTHING;