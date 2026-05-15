-- Diguinho chat history
CREATE TABLE public.diguinho_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_diguinho_user ON public.diguinho_messages(user_id, created_at);
ALTER TABLE public.diguinho_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages select" ON public.diguinho_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own messages insert" ON public.diguinho_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own messages delete" ON public.diguinho_messages FOR DELETE USING (auth.uid() = user_id);

-- Optional: cache Facebook insights snapshots
CREATE TABLE public.facebook_insights_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id text NOT NULL,
  date_preset text NOT NULL,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fb_cache ON public.facebook_insights_cache(ad_account_id, date_preset, fetched_at DESC);
ALTER TABLE public.facebook_insights_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers read fb cache" ON public.facebook_insights_cache FOR SELECT USING (public.is_manager(auth.uid()));
CREATE POLICY "managers insert fb cache" ON public.facebook_insights_cache FOR INSERT WITH CHECK (public.is_manager(auth.uid()));

-- Seed permissions for new resources
INSERT INTO public.role_permissions (role, resource, action) VALUES
  ('admin','facebook','view'), ('gerente','facebook','view'),
  ('admin','diguinho','view'), ('gerente','diguinho','view'), ('membro','diguinho','view')
ON CONFLICT DO NOTHING;