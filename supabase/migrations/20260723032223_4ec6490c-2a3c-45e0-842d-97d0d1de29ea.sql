
CREATE TABLE public.client_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.client_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.client_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_teams TO authenticated;
GRANT ALL ON public.client_teams TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_team_members TO authenticated;
GRANT ALL ON public.client_team_members TO service_role;

ALTER TABLE public.client_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers manage client_teams"
  ON public.client_teams FOR ALL TO authenticated
  USING (public.is_manager(auth.uid()))
  WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "Members read teams they belong to"
  ON public.client_teams FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_team_members m
      WHERE m.team_id = client_teams.id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Managers manage team members"
  ON public.client_team_members FOR ALL TO authenticated
  USING (public.is_manager(auth.uid()))
  WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "Users read own team memberships"
  ON public.client_team_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_client_teams_client ON public.client_teams(client_id);
CREATE UNIQUE INDEX uq_client_teams_default
  ON public.client_teams(client_id) WHERE is_default = true;
CREATE INDEX idx_client_team_members_team ON public.client_team_members(team_id);
CREATE INDEX idx_client_team_members_user ON public.client_team_members(user_id);

CREATE TRIGGER trg_client_teams_updated
  BEFORE UPDATE ON public.client_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.projects
  ADD COLUMN team_id UUID REFERENCES public.client_teams(id) ON DELETE SET NULL;
CREATE INDEX idx_projects_team ON public.projects(team_id);
