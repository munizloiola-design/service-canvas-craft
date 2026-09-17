ALTER TABLE public.client_briefings
  ADD COLUMN IF NOT EXISTS redes_sociais jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS referencias_pesquisa jsonb NOT NULL DEFAULT '[]'::jsonb;