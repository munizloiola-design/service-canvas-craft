
-- Enums for service and media type
CREATE TYPE public.service_type AS ENUM ('design_grafico','social_media','video','fotografia','web','branding','copywriting','outro');
CREATE TYPE public.media_type AS ENUM ('post','story','reels','video','banner','logo','site','impresso','outro');

-- Add columns to projects
ALTER TABLE public.projects
  ADD COLUMN service_type public.service_type,
  ADD COLUMN media_type public.media_type,
  ADD COLUMN start_date date,
  ADD COLUMN reference_links text[] NOT NULL DEFAULT '{}',
  ADD COLUMN notes text;

-- Attachments table
CREATE TABLE public.project_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments_select_all" ON public.project_attachments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "attachments_insert_auth" ON public.project_attachments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "attachments_delete_managers" ON public.project_attachments
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR uploaded_by = auth.uid());

CREATE INDEX idx_project_attachments_project ON public.project_attachments(project_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('project-files','project-files', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "project_files_select_auth" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'project-files');

CREATE POLICY "project_files_insert_auth" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-files');

CREATE POLICY "project_files_delete_managers" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'project-files' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR owner = auth.uid()));
