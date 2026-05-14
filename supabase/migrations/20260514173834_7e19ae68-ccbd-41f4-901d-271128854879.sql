
-- 1. role_permissions
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  resource text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, resource, action)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY rp_select ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY rp_insert ON public.role_permissions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY rp_update ON public.role_permissions FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY rp_delete ON public.role_permissions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. has_permission helper
CREATE OR REPLACE FUNCTION public.has_permission(_uid uuid, _resource text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _uid
      AND rp.resource = _resource
      AND rp.action = _action
  )
$$;

-- 3. Seed default permissions
DO $$
DECLARE
  res text;
  act text;
  resources text[] := ARRAY['dashboard','projects','financeiro','orcamento','equipamentos','team','cadastros','calendario'];
  actions text[] := ARRAY['view','create','edit','delete'];
BEGIN
  -- admin: all
  FOREACH res IN ARRAY resources LOOP
    FOREACH act IN ARRAY actions LOOP
      INSERT INTO public.role_permissions (role, resource, action) VALUES ('admin', res, act) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  -- gerente: all view/create/edit, delete only on operational resources
  FOREACH res IN ARRAY resources LOOP
    INSERT INTO public.role_permissions (role, resource, action) VALUES ('gerente', res, 'view') ON CONFLICT DO NOTHING;
    INSERT INTO public.role_permissions (role, resource, action) VALUES ('gerente', res, 'create') ON CONFLICT DO NOTHING;
    INSERT INTO public.role_permissions (role, resource, action) VALUES ('gerente', res, 'edit') ON CONFLICT DO NOTHING;
  END LOOP;
  FOREACH res IN ARRAY ARRAY['projects','financeiro','orcamento','equipamentos','calendario'] LOOP
    INSERT INTO public.role_permissions (role, resource, action) VALUES ('gerente', res, 'delete') ON CONFLICT DO NOTHING;
  END LOOP;
  -- membro: view dashboard, projects, team, calendario, orcamento, equipamentos; edit own projects
  FOREACH res IN ARRAY ARRAY['dashboard','projects','team','calendario','orcamento','equipamentos'] LOOP
    INSERT INTO public.role_permissions (role, resource, action) VALUES ('membro', res, 'view') ON CONFLICT DO NOTHING;
  END LOOP;
  INSERT INTO public.role_permissions (role, resource, action) VALUES ('membro','projects','edit') ON CONFLICT DO NOTHING;
END $$;

-- 4. dashboard_widgets
CREATE TABLE public.dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  widget_key text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  size text NOT NULL DEFAULT 'md',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX dashboard_widgets_user_idx ON public.dashboard_widgets (user_id, position);

ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY dw_select ON public.dashboard_widgets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY dw_insert ON public.dashboard_widgets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY dw_update ON public.dashboard_widgets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY dw_delete ON public.dashboard_widgets FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER dashboard_widgets_updated_at BEFORE UPDATE ON public.dashboard_widgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. Index for status timer
CREATE INDEX IF NOT EXISTS pt_project_created_idx ON public.project_transitions (project_id, created_at);
