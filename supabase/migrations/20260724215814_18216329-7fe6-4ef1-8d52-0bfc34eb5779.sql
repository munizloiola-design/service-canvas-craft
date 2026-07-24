
CREATE TABLE public.crm_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_stages TO authenticated;
GRANT ALL ON public.crm_stages TO service_role;

ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_stages_select_authenticated" ON public.crm_stages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "crm_stages_insert_manager" ON public.crm_stages
  FOR INSERT TO authenticated WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "crm_stages_update_manager" ON public.crm_stages
  FOR UPDATE TO authenticated USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "crm_stages_delete_manager" ON public.crm_stages
  FOR DELETE TO authenticated USING (public.is_manager(auth.uid()));

CREATE TRIGGER crm_stages_updated_at
  BEFORE UPDATE ON public.crm_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.crm_stages (name, sort_order, is_won, is_lost) VALUES
  ('Novo lead', 10, false, false),
  ('Qualificação', 20, false, false),
  ('Proposta enviada', 30, false, false),
  ('Negociação', 40, false, false),
  ('Ganho', 50, true, false),
  ('Perdido', 60, false, true);
