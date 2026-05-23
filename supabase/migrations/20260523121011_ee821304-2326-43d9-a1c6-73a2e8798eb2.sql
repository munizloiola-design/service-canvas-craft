ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid;

ALTER TABLE public.financial_entries
  DROP CONSTRAINT IF EXISTS financial_entries_source_type_check;
ALTER TABLE public.financial_entries
  ADD CONSTRAINT financial_entries_source_type_check
  CHECK (source_type IS NULL OR source_type IN ('recurring_income','fixed_cost','manual'));

CREATE INDEX IF NOT EXISTS financial_entries_source_idx
  ON public.financial_entries (source_type, source_id, entry_date);