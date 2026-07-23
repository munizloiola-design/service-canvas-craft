
-- 1) pending_registrations.notes
ALTER TABLE public.pending_registrations ADD COLUMN IF NOT EXISTS notes text;

-- 2) financial_categories
CREATE TABLE IF NOT EXISTS public.financial_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('expense','income')),
  is_fixed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, name)
);
GRANT SELECT ON public.financial_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.financial_categories TO authenticated;
GRANT ALL ON public.financial_categories TO service_role;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fcat_select ON public.financial_categories;
CREATE POLICY fcat_select ON public.financial_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS fcat_insert ON public.financial_categories;
CREATE POLICY fcat_insert ON public.financial_categories FOR INSERT TO authenticated WITH CHECK (public.is_manager(auth.uid()));
DROP POLICY IF EXISTS fcat_update ON public.financial_categories;
CREATE POLICY fcat_update ON public.financial_categories FOR UPDATE TO authenticated USING (public.is_manager(auth.uid()));
DROP POLICY IF EXISTS fcat_delete ON public.financial_categories;
CREATE POLICY fcat_delete ON public.financial_categories FOR DELETE TO authenticated USING (public.is_manager(auth.uid()));

DROP TRIGGER IF EXISTS trg_fcat_updated_at ON public.financial_categories;
CREATE TRIGGER trg_fcat_updated_at BEFORE UPDATE ON public.financial_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.financial_entries ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL;
ALTER TABLE public.fixed_costs ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL;
ALTER TABLE public.recurring_incomes ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL;

-- 3) app_branding login customization
ALTER TABLE public.app_branding ADD COLUMN IF NOT EXISTS login_client_label text DEFAULT 'Cliente';
ALTER TABLE public.app_branding ADD COLUMN IF NOT EXISTS login_client_desc text DEFAULT 'Acesso ao portal para acompanhar demandas e materiais.';
ALTER TABLE public.app_branding ADD COLUMN IF NOT EXISTS login_agency_label text DEFAULT 'Agência';
ALTER TABLE public.app_branding ADD COLUMN IF NOT EXISTS login_agency_desc text DEFAULT 'Acesso da equipe e administradores.';
ALTER TABLE public.app_branding ADD COLUMN IF NOT EXISTS button_color text;

-- 4) equipments depreciation extras
ALTER TABLE public.equipments ADD COLUMN IF NOT EXISTS useful_life_months integer;
ALTER TABLE public.equipments ADD COLUMN IF NOT EXISTS depreciation_per_use numeric;
