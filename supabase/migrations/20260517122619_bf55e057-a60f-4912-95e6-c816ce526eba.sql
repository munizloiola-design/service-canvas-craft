
-- client_users table
CREATE TABLE IF NOT EXISTS public.client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, client_id)
);

ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY cu_select_own ON public.client_users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_manager(auth.uid()));
CREATE POLICY cu_insert_mgr ON public.client_users FOR INSERT TO authenticated
  WITH CHECK (is_manager(auth.uid()));
CREATE POLICY cu_update_mgr ON public.client_users FOR UPDATE TO authenticated
  USING (is_manager(auth.uid()));
CREATE POLICY cu_delete_mgr ON public.client_users FOR DELETE TO authenticated
  USING (is_manager(auth.uid()));

-- Helper: has client access
CREATE OR REPLACE FUNCTION public.has_client_access(_uid uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.client_users WHERE user_id = _uid AND client_id = _client_id)
$$;

-- Helper: is client user (any link)
CREATE OR REPLACE FUNCTION public.is_client_user(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.client_users WHERE user_id = _uid)
$$;

-- Client portal SELECT policies
CREATE POLICY projects_select_client ON public.projects FOR SELECT TO authenticated
  USING (client_id IS NOT NULL AND public.has_client_access(auth.uid(), client_id));

CREATE POLICY clients_select_client ON public.clients FOR SELECT TO authenticated
  USING (public.has_client_access(auth.uid(), id));

-- media_types and workflow_statuses already public to authenticated; skip
-- project_attachments: clients can view attachments of projects they own
CREATE POLICY attachments_select_client ON public.project_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_attachments.project_id AND public.has_client_access(auth.uid(), p.client_id)));

-- Allow client user to UPDATE decision fields on own project (used by RPC below; RPC bypasses anyway)
-- Authenticated decision RPC
CREATE OR REPLACE FUNCTION public.submit_client_decision_authed(_project_id uuid, _decision text, _feedback text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _cid uuid;
BEGIN
  IF _decision NOT IN ('aprovado','reprovado') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  SELECT client_id INTO _cid FROM public.projects WHERE id = _project_id;
  IF _cid IS NULL OR NOT public.has_client_access(auth.uid(), _cid) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.projects
    SET client_decision = _decision,
        client_feedback = _feedback,
        client_decided_at = now(),
        status_id = CASE
          WHEN _decision = 'aprovado' THEN (SELECT id FROM public.workflow_statuses WHERE is_final = true ORDER BY sort_order LIMIT 1)
          ELSE (SELECT id FROM public.workflow_statuses ORDER BY sort_order LIMIT 1)
        END
    WHERE id = _project_id;
  RETURN true;
END $$;

REVOKE EXECUTE ON FUNCTION public.submit_client_decision_authed(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_client_decision_authed(uuid, text, text) TO authenticated;
