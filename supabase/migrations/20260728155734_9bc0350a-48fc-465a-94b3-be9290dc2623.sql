
-- Seed: área "Administração" + especialidade "Total" com todas as chaves de menu
DO $$
DECLARE
  v_area_id uuid;
  v_spec_id uuid;
  v_key text;
  v_menu_keys text[] := ARRAY[
    '/dashboard',
    '/projects','/tickets','/calendario','/equipamentos','/tempo','/parceiros',
    '/clientes','/clientes/crm',
    '/financeiro','/orcamento',
    '/facebook','/diguinho',
    '/team','/squad','/squad/relatorio','/aprovacoes','/acessos',
    '/cadastros','/integracoes','/personalizacao'
  ];
BEGIN
  SELECT id INTO v_area_id FROM public.provider_areas WHERE name = 'Administração' LIMIT 1;
  IF v_area_id IS NULL THEN
    INSERT INTO public.provider_areas (name, sort_order)
    VALUES ('Administração', COALESCE((SELECT MAX(sort_order)+1 FROM public.provider_areas), 0))
    RETURNING id INTO v_area_id;
  END IF;

  SELECT id INTO v_spec_id FROM public.provider_specialties WHERE area_id = v_area_id AND name = 'Total' LIMIT 1;
  IF v_spec_id IS NULL THEN
    INSERT INTO public.provider_specialties (area_id, name, sort_order)
    VALUES (v_area_id, 'Total', 0)
    RETURNING id INTO v_spec_id;
  END IF;

  FOREACH v_key IN ARRAY v_menu_keys LOOP
    INSERT INTO public.area_menu_visibility (area_id, menu_key)
    VALUES (v_area_id, v_key)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Vincula todos os admins e admin_master à especialidade Total
  INSERT INTO public.user_specialties (user_id, specialty_id)
  SELECT DISTINCT ur.user_id, v_spec_id
    FROM public.user_roles ur
   WHERE ur.role IN ('admin'::app_role, 'admin_master'::app_role)
     AND NOT EXISTS (
       SELECT 1 FROM public.user_specialties us
        WHERE us.user_id = ur.user_id AND us.specialty_id = v_spec_id
     );
END $$;
