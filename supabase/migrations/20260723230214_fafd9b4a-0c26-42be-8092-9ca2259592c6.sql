-- Backfill client_teams from clients.team_id
INSERT INTO public.client_teams (client_id, name, is_default)
SELECT c.id, COALESCE(t.name, 'Time principal'), true
FROM public.clients c
JOIN public.teams t ON t.id = c.team_id
WHERE c.team_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.client_teams ct WHERE ct.client_id = c.id AND ct.is_default = true
  );

-- Copy team members into client_team_members
INSERT INTO public.client_team_members (team_id, user_id, role_hint)
SELECT ct.id, tm.user_id, NULL
FROM public.clients c
JOIN public.teams t ON t.id = c.team_id
JOIN public.team_members tm ON tm.team_id = t.id
JOIN public.client_teams ct ON ct.client_id = c.id AND ct.is_default = true
WHERE c.team_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Drop legacy column
ALTER TABLE public.clients DROP COLUMN IF EXISTS team_id;