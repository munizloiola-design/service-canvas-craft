ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_team_id_fkey;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_team_id_fkey
  FOREIGN KEY (team_id)
  REFERENCES public.teams(id)
  ON DELETE SET NULL;