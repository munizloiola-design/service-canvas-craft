
-- Branding table (single row)
CREATE TABLE public.app_branding (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  brand_name text NOT NULL DEFAULT 'Equipe.io',
  logo_url text,
  favicon_url text,
  primary_color text NOT NULL DEFAULT '#3b82f6',
  accent_color text NOT NULL DEFAULT '#8b5cf6',
  suggestions text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY brand_select_public ON public.app_branding FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY brand_insert_mgr ON public.app_branding FOR INSERT TO authenticated WITH CHECK (is_manager(auth.uid()));
CREATE POLICY brand_update_mgr ON public.app_branding FOR UPDATE TO authenticated USING (is_manager(auth.uid()));
INSERT INTO public.app_branding (id) VALUES (true) ON CONFLICT DO NOTHING;

-- Email templates
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  subject text NOT NULL,
  body_html text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY et_select_auth ON public.email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY et_insert_mgr ON public.email_templates FOR INSERT TO authenticated WITH CHECK (is_manager(auth.uid()));
CREATE POLICY et_update_mgr ON public.email_templates FOR UPDATE TO authenticated USING (is_manager(auth.uid()));

INSERT INTO public.email_templates (key, subject, body_html) VALUES
('ticket_approved',
 'Sua solicitação foi aprovada — {{title}}',
 '<p>Olá {{requester_name}},</p><p>Recebemos e <strong>aprovamos</strong> sua solicitação <em>{{title}}</em>. Nossa equipe já começou a trabalhar nela.</p><p>Em breve entraremos em contato com mais detalhes.</p><p>Obrigado!</p>'),
('ticket_rejected',
 'Atualização sobre sua solicitação — {{title}}',
 '<p>Olá {{requester_name}},</p><p>Sua solicitação <em>{{title}}</em> foi avaliada, mas no momento não podemos seguir com ela.</p><p><strong>Observação:</strong><br/>{{review_notes}}</p><p>Se quiser, ajuste e envie novamente. Obrigado pelo contato.</p>')
ON CONFLICT (key) DO NOTHING;

-- Internal notes on ticket requests
ALTER TABLE public.ticket_requests ADD COLUMN IF NOT EXISTS internal_notes text;

-- Branding permission
INSERT INTO public.role_permissions (role, resource, action) VALUES
('admin','branding','view'),('admin','branding','manage'),
('gerente','branding','view'),('gerente','branding','manage')
ON CONFLICT DO NOTHING;

-- Brand assets bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-assets','brand-assets',true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY brand_assets_read ON storage.objects FOR SELECT USING (bucket_id = 'brand-assets');
CREATE POLICY brand_assets_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'brand-assets' AND is_manager(auth.uid()));
CREATE POLICY brand_assets_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'brand-assets' AND is_manager(auth.uid()));
CREATE POLICY brand_assets_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'brand-assets' AND is_manager(auth.uid()));
