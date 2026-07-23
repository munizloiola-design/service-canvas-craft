
-- 1. pending_registrations
CREATE TABLE IF NOT EXISTS public.pending_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('cliente','usuario')),
  full_name text NOT NULL,
  email text NOT NULL,
  company_name text,
  phone text,
  requested_role app_role,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_reason text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pending_reg_status ON public.pending_registrations(status);

GRANT SELECT, UPDATE ON public.pending_registrations TO authenticated;
GRANT INSERT ON public.pending_registrations TO anon, authenticated;
GRANT ALL ON public.pending_registrations TO service_role;

ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit registrations" ON public.pending_registrations;
CREATE POLICY "Anyone can submit registrations" ON public.pending_registrations
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS "Managers view registrations" ON public.pending_registrations;
CREATE POLICY "Managers view registrations" ON public.pending_registrations
  FOR SELECT TO authenticated
  USING (public.is_manager(auth.uid()));

DROP POLICY IF EXISTS "Managers update registrations" ON public.pending_registrations;
CREATE POLICY "Managers update registrations" ON public.pending_registrations
  FOR UPDATE TO authenticated
  USING (public.is_manager(auth.uid()))
  WITH CHECK (public.is_manager(auth.uid()));

-- 2. profiles: password setup link
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_setup_link text,
  ADD COLUMN IF NOT EXISTS password_setup_expires_at timestamptz;

-- 3. app_branding: contato
ALTER TABLE public.app_branding
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

-- 4. role_permissions seed
INSERT INTO public.role_permissions (role, resource, action) VALUES
  ('cliente','portal_dashboard','view'),
  ('cliente','portal_estrategia','view'),
  ('admin','portal_dashboard','view'),
  ('admin','portal_dashboard','manage'),
  ('admin','contato_empresa','view'),
  ('admin','contato_empresa','manage'),
  ('admin','aprovacoes','view'),
  ('admin','aprovacoes','manage'),
  ('gerente','aprovacoes','view'),
  ('gerente','aprovacoes','manage'),
  ('gerente','portal_dashboard','view')
ON CONFLICT DO NOTHING;
