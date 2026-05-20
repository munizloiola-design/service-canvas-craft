ALTER TABLE public.client_briefings
  ADD COLUMN IF NOT EXISTS swot_forcas text,
  ADD COLUMN IF NOT EXISTS swot_fraquezas text,
  ADD COLUMN IF NOT EXISTS swot_oportunidades text,
  ADD COLUMN IF NOT EXISTS swot_ameacas text;