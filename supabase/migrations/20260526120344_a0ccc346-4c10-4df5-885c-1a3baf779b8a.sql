TRUNCATE TABLE public.financial_entries CASCADE;
TRUNCATE TABLE public.fixed_costs CASCADE;
TRUNCATE TABLE public.recurring_incomes CASCADE;
TRUNCATE TABLE public.budget_simulations CASCADE;
UPDATE public.financial_settings SET tax_pct = 6, default_commission_pct = 0, currency = 'BRL', updated_at = now() WHERE id = true;