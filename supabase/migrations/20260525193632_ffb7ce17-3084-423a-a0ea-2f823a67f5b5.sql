-- Helper imutável: primeiro dia do mês de uma data (necessário para índice único).
CREATE OR REPLACE FUNCTION public.month_floor(_d date)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT make_date(extract(year FROM _d)::int, extract(month FROM _d)::int, 1)
$$;

-- 1) Deduplicar entries existentes mantendo a mais antiga por (source_type, source_id, mês).
WITH dups AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY source_type, source_id, public.month_floor(entry_date)
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.financial_entries
  WHERE source_id IS NOT NULL
)
DELETE FROM public.financial_entries fe
USING dups
WHERE fe.id = dups.id AND dups.rn > 1;

-- 2) Índice único parcial.
CREATE UNIQUE INDEX IF NOT EXISTS financial_entries_unique_source_per_month
  ON public.financial_entries (source_type, source_id, public.month_floor(entry_date))
  WHERE source_id IS NOT NULL;