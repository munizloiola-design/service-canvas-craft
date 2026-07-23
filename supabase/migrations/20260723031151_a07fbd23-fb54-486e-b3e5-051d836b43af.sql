ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS description_cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS final_link text;