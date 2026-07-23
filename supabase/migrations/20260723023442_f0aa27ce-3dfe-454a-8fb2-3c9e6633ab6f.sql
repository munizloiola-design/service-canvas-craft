
CREATE TABLE public.time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status_id UUID REFERENCES public.workflow_statuses(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_logs_project ON public.time_logs(project_id);
CREATE INDEX idx_time_logs_user ON public.time_logs(user_id);
CREATE INDEX idx_time_logs_started ON public.time_logs(started_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_logs TO authenticated;
GRANT ALL ON public.time_logs TO service_role;

ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_logs_own_select" ON public.time_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "time_logs_managers_select_all" ON public.time_logs
  FOR SELECT USING (public.is_manager(auth.uid()) OR public.is_master(auth.uid()));

CREATE POLICY "time_logs_own_insert" ON public.time_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "time_logs_own_update" ON public.time_logs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "time_logs_own_delete" ON public.time_logs
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE VIEW public.time_logs_with_duration
WITH (security_invoker = true) AS
  SELECT
    id, project_id, user_id, status_id, started_at, ended_at, created_at,
    EXTRACT(EPOCH FROM (ended_at - started_at))::INT AS duration_seconds
  FROM public.time_logs;

GRANT SELECT ON public.time_logs_with_duration TO authenticated;
