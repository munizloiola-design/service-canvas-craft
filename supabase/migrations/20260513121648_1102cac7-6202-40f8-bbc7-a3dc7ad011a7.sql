
-- Equipamentos
CREATE TABLE public.equipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  type text,
  acquisition_value numeric NOT NULL DEFAULT 0,
  acquisition_date date NOT NULL DEFAULT CURRENT_DATE,
  depreciation_pct_year numeric NOT NULL DEFAULT 20,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY equipments_select ON public.equipments FOR SELECT TO authenticated USING (true);
CREATE POLICY equipments_insert_mgr ON public.equipments FOR INSERT TO authenticated WITH CHECK (is_manager(auth.uid()));
CREATE POLICY equipments_update_mgr ON public.equipments FOR UPDATE TO authenticated USING (is_manager(auth.uid()));
CREATE POLICY equipments_delete_mgr ON public.equipments FOR DELETE TO authenticated USING (is_manager(auth.uid()));
CREATE TRIGGER trg_equipments_updated BEFORE UPDATE ON public.equipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Custos fixos
CREATE TABLE public.fixed_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  amount numeric NOT NULL DEFAULT 0,
  recurrence text NOT NULL DEFAULT 'monthly', -- monthly | annual
  due_day int,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY fc_select ON public.fixed_costs FOR SELECT TO authenticated USING (true);
CREATE POLICY fc_insert ON public.fixed_costs FOR INSERT TO authenticated WITH CHECK (is_manager(auth.uid()));
CREATE POLICY fc_update ON public.fixed_costs FOR UPDATE TO authenticated USING (is_manager(auth.uid()));
CREATE POLICY fc_delete ON public.fixed_costs FOR DELETE TO authenticated USING (is_manager(auth.uid()));
CREATE TRIGGER trg_fc_updated BEFORE UPDATE ON public.fixed_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Receitas recorrentes
CREATE TABLE public.recurring_incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  recurrence text NOT NULL DEFAULT 'monthly',
  next_due date,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recurring_incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY ri_select ON public.recurring_incomes FOR SELECT TO authenticated USING (true);
CREATE POLICY ri_insert ON public.recurring_incomes FOR INSERT TO authenticated WITH CHECK (is_manager(auth.uid()));
CREATE POLICY ri_update ON public.recurring_incomes FOR UPDATE TO authenticated USING (is_manager(auth.uid()));
CREATE POLICY ri_delete ON public.recurring_incomes FOR DELETE TO authenticated USING (is_manager(auth.uid()));
CREATE TRIGGER trg_ri_updated BEFORE UPDATE ON public.recurring_incomes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Lançamentos avulsos
CREATE TABLE public.financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL, -- income | expense
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  category text,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  receipt_path text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY fe_select ON public.financial_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY fe_insert ON public.financial_entries FOR INSERT TO authenticated WITH CHECK (is_manager(auth.uid()));
CREATE POLICY fe_update ON public.financial_entries FOR UPDATE TO authenticated USING (is_manager(auth.uid()));
CREATE POLICY fe_delete ON public.financial_entries FOR DELETE TO authenticated USING (is_manager(auth.uid()));
CREATE TRIGGER trg_fe_updated BEFORE UPDATE ON public.financial_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Configurações financeiras (singleton)
CREATE TABLE public.financial_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  tax_pct numeric NOT NULL DEFAULT 6,
  default_commission_pct numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY fs_select ON public.financial_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY fs_insert ON public.financial_settings FOR INSERT TO authenticated WITH CHECK (is_manager(auth.uid()));
CREATE POLICY fs_update ON public.financial_settings FOR UPDATE TO authenticated USING (is_manager(auth.uid()));
INSERT INTO public.financial_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- Simulações de orçamento salvas
CREATE TABLE public.budget_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hours numeric NOT NULL DEFAULT 0,
  fixed_cost_total numeric NOT NULL DEFAULT 0,
  professionals jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{user_id, hourly_cost, hours}]
  profit_pct numeric NOT NULL DEFAULT 30,
  tax_pct numeric NOT NULL DEFAULT 6,
  total_cost numeric NOT NULL DEFAULT 0,
  suggested_price numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.budget_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY bs_select ON public.budget_simulations FOR SELECT TO authenticated USING (true);
CREATE POLICY bs_insert ON public.budget_simulations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY bs_delete ON public.budget_simulations FOR DELETE TO authenticated USING (is_manager(auth.uid()));

-- Custo/hora e comissão por colaborador
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hourly_cost numeric NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS commission_pct numeric NOT NULL DEFAULT 0;

-- Bucket de comprovantes
INSERT INTO storage.buckets (id, name, public) VALUES ('financial-receipts', 'financial-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "receipts_select_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'financial-receipts');
CREATE POLICY "receipts_insert_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'financial-receipts' AND auth.uid() IS NOT NULL);
CREATE POLICY "receipts_delete_mgr" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'financial-receipts' AND is_manager(auth.uid()));
