
-- ============ CADASTROS CONFIGURÁVEIS ============

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.media_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.workflow_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#64748b',
  is_review boolean NOT NULL DEFAULT false,
  is_client_validation boolean NOT NULL DEFAULT false,
  is_final boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  level int NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#64748b',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.text_snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ EVOLUÇÃO PROJECTS ============

ALTER TABLE public.projects
  ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN media_type_id uuid REFERENCES public.media_types(id) ON DELETE SET NULL,
  ADD COLUMN status_id uuid REFERENCES public.workflow_statuses(id) ON DELETE SET NULL,
  ADD COLUMN priority_id uuid REFERENCES public.priorities(id) ON DELETE SET NULL,
  ADD COLUMN post_date date,
  ADD COLUMN has_reference boolean NOT NULL DEFAULT false,
  ADD COLUMN deliverable_path text,
  ADD COLUMN client_token text UNIQUE,
  ADD COLUMN client_decision text CHECK (client_decision IN ('aprovado','reprovado')),
  ADD COLUMN client_feedback text,
  ADD COLUMN client_decided_at timestamptz;

-- ============ MÚLTIPLOS RESPONSÁVEIS ============

CREATE TABLE public.project_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_id uuid REFERENCES public.project_roles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id, role_id)
);

CREATE INDEX idx_assignees_project ON public.project_assignees(project_id);
CREATE INDEX idx_assignees_user ON public.project_assignees(user_id);

-- ============ HISTÓRICO ============

CREATE TABLE public.project_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  from_status_id uuid REFERENCES public.workflow_statuses(id) ON DELETE SET NULL,
  to_status_id uuid REFERENCES public.workflow_statuses(id) ON DELETE SET NULL,
  changed_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_transitions_project ON public.project_transitions(project_id);

-- ============ TRIGGERS updated_at ============

CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ RLS ============

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.text_snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_transitions ENABLE ROW LEVEL SECURITY;

-- helper: admin or gerente
CREATE OR REPLACE FUNCTION public.is_manager(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'admin'::app_role) OR public.has_role(_uid, 'gerente'::app_role)
$$;

-- generic: authenticated read, manager write
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients','media_types','workflow_statuses','priorities','project_roles','text_snippets']
  LOOP
    EXECUTE format('CREATE POLICY %I_select_auth ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY %I_insert_mgr ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_manager(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY %I_update_mgr ON public.%I FOR UPDATE TO authenticated USING (public.is_manager(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY %I_delete_mgr ON public.%I FOR DELETE TO authenticated USING (public.is_manager(auth.uid()))', t, t);
  END LOOP;
END $$;

-- assignees: read all auth, write managers or own assignment
CREATE POLICY assignees_select ON public.project_assignees FOR SELECT TO authenticated USING (true);
CREATE POLICY assignees_insert_mgr ON public.project_assignees FOR INSERT TO authenticated WITH CHECK (public.is_manager(auth.uid()));
CREATE POLICY assignees_update_mgr ON public.project_assignees FOR UPDATE TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY assignees_delete_mgr ON public.project_assignees FOR DELETE TO authenticated USING (public.is_manager(auth.uid()));

-- transitions: read all auth, insert by anyone authenticated involved with project
CREATE POLICY transitions_select ON public.project_transitions FOR SELECT TO authenticated USING (true);
CREATE POLICY transitions_insert ON public.project_transitions FOR INSERT TO authenticated WITH CHECK (auth.uid() = changed_by);

-- public access for client validation: allow anon to read project by token via security definer fn
CREATE OR REPLACE FUNCTION public.get_project_by_token(_token text)
RETURNS TABLE (
  id uuid, title text, description text, notes text,
  client_name text, deliverable_path text,
  status_name text, media_type_name text,
  client_decision text, client_feedback text, client_decided_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.title, p.description, p.notes,
         c.name, p.deliverable_path,
         s.name, m.name,
         p.client_decision, p.client_feedback, p.client_decided_at
  FROM public.projects p
  LEFT JOIN public.clients c ON c.id = p.client_id
  LEFT JOIN public.workflow_statuses s ON s.id = p.status_id
  LEFT JOIN public.media_types m ON m.id = p.media_type_id
  WHERE p.client_token = _token
$$;

CREATE OR REPLACE FUNCTION public.submit_client_decision(_token text, _decision text, _feedback text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid; _publish_id uuid; _atend_id uuid;
BEGIN
  IF _decision NOT IN ('aprovado','reprovado') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  SELECT id INTO _pid FROM public.projects WHERE client_token = _token AND client_decision IS NULL;
  IF _pid IS NULL THEN RETURN false; END IF;

  UPDATE public.projects
    SET client_decision = _decision,
        client_feedback = _feedback,
        client_decided_at = now(),
        status_id = CASE
          WHEN _decision = 'aprovado' THEN (SELECT id FROM public.workflow_statuses WHERE is_final = true ORDER BY sort_order LIMIT 1)
          ELSE (SELECT id FROM public.workflow_statuses ORDER BY sort_order LIMIT 1)
        END
    WHERE id = _pid;
  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.get_project_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_client_decision(text,text,text) TO anon, authenticated;

-- ============ STORAGE: bucket público para entregáveis assistidos por token (lemos via signed URL no app) ============
-- já existe project-files bucket. Reaproveitar.

-- ============ SEEDS ============

INSERT INTO public.priorities (name, level, color) VALUES
  ('Baixa', 1, '#22c55e'),
  ('Média', 2, '#eab308'),
  ('Alta', 3, '#f97316'),
  ('Urgente', 4, '#ef4444');

INSERT INTO public.workflow_statuses (name, sort_order, color, is_review, is_client_validation, is_final) VALUES
  ('Atendimento', 1, '#3b82f6', false, false, false),
  ('Planejamento', 2, '#8b5cf6', false, false, false),
  ('Produção', 3, '#06b6d4', false, false, false),
  ('Revisão', 4, '#f59e0b', true, false, false),
  ('Validação do cliente', 5, '#ec4899', false, true, false),
  ('Publicação', 6, '#22c55e', false, false, true);

INSERT INTO public.media_types (name, sort_order) VALUES
  ('Post', 1), ('Story', 2), ('Reels', 3), ('Vídeo', 4),
  ('Banner', 5), ('Logo', 6), ('Site', 7), ('Impresso', 8);

INSERT INTO public.project_roles (name) VALUES
  ('Atendimento'), ('Planejamento'), ('Designer'), ('Redator'),
  ('Editor de vídeo'), ('Fotógrafo'), ('Revisor');
