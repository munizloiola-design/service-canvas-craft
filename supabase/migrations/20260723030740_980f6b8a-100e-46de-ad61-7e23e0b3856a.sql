INSERT INTO public.role_permissions (role, resource, action) VALUES
  ('admin'::app_role, 'time_reports', 'view'),
  ('gerente'::app_role, 'time_reports', 'view')
ON CONFLICT DO NOTHING;