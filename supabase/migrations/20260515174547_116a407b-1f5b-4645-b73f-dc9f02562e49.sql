
-- Table
CREATE TABLE public.ticket_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_phone TEXT,
  company TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  media_type_id UUID REFERENCES public.media_types(id) ON DELETE SET NULL,
  desired_due_date DATE,
  reference_links TEXT[] NOT NULL DEFAULT '{}',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado')),
  review_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_requests_status ON public.ticket_requests(status, created_at DESC);

ALTER TABLE public.ticket_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can submit
CREATE POLICY tr_insert_public ON public.ticket_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pendente' AND reviewed_by IS NULL AND reviewed_at IS NULL AND created_project_id IS NULL);

-- Only managers can read/update/delete
CREATE POLICY tr_select_mgr ON public.ticket_requests
  FOR SELECT TO authenticated
  USING (is_manager(auth.uid()));

CREATE POLICY tr_update_mgr ON public.ticket_requests
  FOR UPDATE TO authenticated
  USING (is_manager(auth.uid()));

CREATE POLICY tr_delete_mgr ON public.ticket_requests
  FOR DELETE TO authenticated
  USING (is_manager(auth.uid()));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Public can upload to ticket-attachments
CREATE POLICY ticket_attachments_public_upload ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'ticket-attachments');

-- Only managers can read attachments
CREATE POLICY ticket_attachments_mgr_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ticket-attachments' AND is_manager(auth.uid()));

CREATE POLICY ticket_attachments_mgr_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ticket-attachments' AND is_manager(auth.uid()));

-- Permissions
INSERT INTO public.role_permissions (role, resource, action) VALUES
  ('admin','tickets','view'),
  ('gerente','tickets','view')
ON CONFLICT DO NOTHING;
