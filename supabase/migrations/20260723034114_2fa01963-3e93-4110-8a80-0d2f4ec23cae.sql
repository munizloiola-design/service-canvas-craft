
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY teams_select ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY teams_insert_mgr ON public.teams FOR INSERT TO authenticated WITH CHECK (public.is_manager(auth.uid()));
CREATE POLICY teams_update_mgr ON public.teams FOR UPDATE TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY teams_delete_mgr ON public.teams FOR DELETE TO authenticated USING (public.is_manager(auth.uid()));
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_members_select ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY team_members_insert_mgr ON public.team_members FOR INSERT TO authenticated WITH CHECK (public.is_manager(auth.uid()));
CREATE POLICY team_members_delete_mgr ON public.team_members FOR DELETE TO authenticated USING (public.is_manager(auth.uid()));

ALTER TABLE public.clients ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
