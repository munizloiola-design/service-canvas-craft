CREATE TABLE public.integration_meta (
  user_id uuid PRIMARY KEY,
  access_token text NOT NULL,
  ad_account_id text NOT NULL,
  page_id text,
  display_name text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.integration_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own meta select" ON public.integration_meta FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own meta insert" ON public.integration_meta FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own meta update" ON public.integration_meta FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own meta delete" ON public.integration_meta FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_meta_updated BEFORE UPDATE ON public.integration_meta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.role_permissions (role, resource, action) VALUES
  ('admin','integracoes','view'), ('gerente','integracoes','view'), ('membro','integracoes','view')
ON CONFLICT DO NOTHING;