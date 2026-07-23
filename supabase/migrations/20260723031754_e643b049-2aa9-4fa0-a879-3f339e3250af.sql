
-- 1) provider_areas
CREATE TABLE public.provider_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_areas TO authenticated;
GRANT ALL ON public.provider_areas TO service_role;
ALTER TABLE public.provider_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "areas_read_auth" ON public.provider_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "areas_write_manager" ON public.provider_areas FOR ALL TO authenticated
  USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));
CREATE TRIGGER trg_provider_areas_updated BEFORE UPDATE ON public.provider_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2) provider_specialties
CREATE TABLE public.provider_specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES public.provider_areas(id) ON DELETE RESTRICT,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (area_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_specialties TO authenticated;
GRANT ALL ON public.provider_specialties TO service_role;
ALTER TABLE public.provider_specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spec_read_auth" ON public.provider_specialties FOR SELECT TO authenticated USING (true);
CREATE POLICY "spec_write_manager" ON public.provider_specialties FOR ALL TO authenticated
  USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));
CREATE TRIGGER trg_provider_specialties_updated BEFORE UPDATE ON public.provider_specialties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3) user_specialties
CREATE TABLE public.user_specialties (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  specialty_id uuid NOT NULL REFERENCES public.provider_specialties(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, specialty_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_specialties TO authenticated;
GRANT ALL ON public.user_specialties TO service_role;
ALTER TABLE public.user_specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "us_read_self_or_manager" ON public.user_specialties FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_manager(auth.uid()));
CREATE POLICY "us_write_manager" ON public.user_specialties FOR ALL TO authenticated
  USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));

-- 4) area_menu_visibility (presença = visível)
CREATE TABLE public.area_menu_visibility (
  area_id uuid NOT NULL REFERENCES public.provider_areas(id) ON DELETE CASCADE,
  menu_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (area_id, menu_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.area_menu_visibility TO authenticated;
GRANT ALL ON public.area_menu_visibility TO service_role;
ALTER TABLE public.area_menu_visibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amv_read_auth" ON public.area_menu_visibility FOR SELECT TO authenticated USING (true);
CREATE POLICY "amv_write_manager" ON public.area_menu_visibility FOR ALL TO authenticated
  USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));

-- 5) specialty_field_visibility
CREATE TABLE public.specialty_field_visibility (
  specialty_id uuid NOT NULL REFERENCES public.provider_specialties(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  can_view boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (specialty_id, field_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.specialty_field_visibility TO authenticated;
GRANT ALL ON public.specialty_field_visibility TO service_role;
ALTER TABLE public.specialty_field_visibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sfv_read_auth" ON public.specialty_field_visibility FOR SELECT TO authenticated USING (true);
CREATE POLICY "sfv_write_manager" ON public.specialty_field_visibility FOR ALL TO authenticated
  USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));
CREATE TRIGGER trg_sfv_updated BEFORE UPDATE ON public.specialty_field_visibility
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6) Seed: cria Área "Geral" e migra collaborator_functions → provider_specialties
INSERT INTO public.provider_areas (name, sort_order) VALUES ('Geral', 0)
  ON CONFLICT (name) DO NOTHING;

WITH area AS (SELECT id FROM public.provider_areas WHERE name='Geral')
INSERT INTO public.provider_specialties (area_id, name, sort_order)
SELECT (SELECT id FROM area), cf.name, COALESCE(cf.sort_order, 0)
FROM public.collaborator_functions cf
ON CONFLICT (area_id, name) DO NOTHING;

-- 7) Migra user_functions → user_specialties (mapeando por nome)
INSERT INTO public.user_specialties (user_id, specialty_id)
SELECT uf.user_id, ps.id
FROM public.user_functions uf
JOIN public.collaborator_functions cf ON cf.id = uf.function_id
JOIN public.provider_specialties ps ON ps.name = cf.name
ON CONFLICT DO NOTHING;

-- 8) Migra function_field_visibility → specialty_field_visibility
INSERT INTO public.specialty_field_visibility (specialty_id, field_key, can_view, can_edit)
SELECT ps.id, ffv.field_key, COALESCE(ffv.visible, true), COALESCE(ffv.visible, true)
FROM public.function_field_visibility ffv
JOIN public.collaborator_functions cf ON cf.id = ffv.function_id
JOIN public.provider_specialties ps ON ps.name = cf.name
ON CONFLICT (specialty_id, field_key) DO NOTHING;
