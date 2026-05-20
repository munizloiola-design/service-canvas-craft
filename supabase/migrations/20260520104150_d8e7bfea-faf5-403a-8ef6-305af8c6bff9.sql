CREATE TABLE public.client_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE,
  historia text,
  missao text,
  visao text,
  valores text,
  analise_redes text,
  publico_alvo text,
  persona text,
  objecoes text,
  arquetipo text,
  referencias text,
  concorrencia text,
  canais text,
  objetivos_mes text,
  materiais jsonb NOT NULL DEFAULT '[]'::jsonb,
  indicadores jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY cb_select ON public.client_briefings FOR SELECT TO authenticated
  USING (is_manager(auth.uid()) OR has_client_access(auth.uid(), client_id));
CREATE POLICY cb_insert ON public.client_briefings FOR INSERT TO authenticated
  WITH CHECK (is_manager(auth.uid()));
CREATE POLICY cb_update ON public.client_briefings FOR UPDATE TO authenticated
  USING (is_manager(auth.uid()));
CREATE POLICY cb_delete ON public.client_briefings FOR DELETE TO authenticated
  USING (is_manager(auth.uid()));

CREATE TRIGGER trg_client_briefings_updated_at BEFORE UPDATE ON public.client_briefings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.role_permissions (role, resource, action) VALUES
  ('admin','clientes_area','view'),('admin','clientes_area','create'),('admin','clientes_area','edit'),('admin','clientes_area','delete'),
  ('gerente','clientes_area','view'),('gerente','clientes_area','create'),('gerente','clientes_area','edit')
ON CONFLICT DO NOTHING;