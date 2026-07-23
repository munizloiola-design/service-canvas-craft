
ALTER TABLE public.client_briefings
  ADD COLUMN IF NOT EXISTS tom_de_voz text;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS prospect_stage text,
  ADD COLUMN IF NOT EXISTS prospect_value numeric,
  ADD COLUMN IF NOT EXISTS prospect_next_action text,
  ADD COLUMN IF NOT EXISTS prospect_next_action_at date;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_status_check') THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_status_check CHECK (status IN ('ativo','inativo','prospeccao'));
  END IF;
END $$;
