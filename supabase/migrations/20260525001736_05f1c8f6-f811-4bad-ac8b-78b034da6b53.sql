CREATE OR REPLACE FUNCTION public._fin_norm(_t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(lower(public.unaccent_safe(coalesce(_t, ''))), '\s+', ' ', 'g')
$$;

-- Expenses → fixed_costs
WITH candidates AS (
  SELECT
    e.id AS entry_id,
    fc.id AS fc_id,
    (e.entry_date - (EXTRACT(DAY FROM e.entry_date)::int - 1)) AS month_start
  FROM public.financial_entries e
  JOIN public.fixed_costs fc
    ON public._fin_norm(fc.name) = public._fin_norm(e.description)
   AND public._fin_norm(fc.name) <> ''
  WHERE e.kind = 'expense' AND e.source_id IS NULL
),
unique_matches AS (
  SELECT entry_id, month_start, (array_agg(DISTINCT fc_id))[1] AS fc_id
  FROM candidates
  GROUP BY entry_id, month_start
  HAVING COUNT(DISTINCT fc_id) = 1
),
safe_matches AS (
  SELECT um.* FROM unique_matches um
  WHERE NOT EXISTS (
    SELECT 1 FROM public.financial_entries x
    WHERE x.source_type = 'fixed_cost'
      AND x.source_id = um.fc_id
      AND (x.entry_date - (EXTRACT(DAY FROM x.entry_date)::int - 1)) = um.month_start
  )
)
UPDATE public.financial_entries e
SET source_type = 'fixed_cost', source_id = sm.fc_id
FROM safe_matches sm
WHERE e.id = sm.entry_id;

-- Incomes → recurring_incomes
WITH candidates AS (
  SELECT
    e.id AS entry_id,
    ri.id AS ri_id,
    (e.entry_date - (EXTRACT(DAY FROM e.entry_date)::int - 1)) AS month_start
  FROM public.financial_entries e
  JOIN public.recurring_incomes ri
    ON public._fin_norm(ri.description) = public._fin_norm(e.description)
   AND public._fin_norm(ri.description) <> ''
  WHERE e.kind = 'income' AND e.source_id IS NULL
),
unique_matches AS (
  SELECT entry_id, month_start, (array_agg(DISTINCT ri_id))[1] AS ri_id
  FROM candidates
  GROUP BY entry_id, month_start
  HAVING COUNT(DISTINCT ri_id) = 1
),
safe_matches AS (
  SELECT um.* FROM unique_matches um
  WHERE NOT EXISTS (
    SELECT 1 FROM public.financial_entries x
    WHERE x.source_type = 'recurring_income'
      AND x.source_id = um.ri_id
      AND (x.entry_date - (EXTRACT(DAY FROM x.entry_date)::int - 1)) = um.month_start
  )
)
UPDATE public.financial_entries e
SET source_type = 'recurring_income', source_id = sm.ri_id
FROM safe_matches sm
WHERE e.id = sm.entry_id;

DROP FUNCTION public._fin_norm(text);
