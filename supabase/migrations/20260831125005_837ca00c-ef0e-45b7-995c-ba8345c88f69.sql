CREATE TABLE public.project_media_types (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  media_type_id uuid NOT NULL REFERENCES public.media_types(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, media_type_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_media_types TO authenticated;
GRANT ALL ON public.project_media_types TO service_role;

ALTER TABLE public.project_media_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pmt_select" ON public.project_media_types
  FOR SELECT TO authenticated
  USING (public.can_view_project(auth.uid(), project_id));

CREATE POLICY "pmt_insert" ON public.project_media_types
  FOR INSERT TO authenticated
  WITH CHECK (public.can_view_project(auth.uid(), project_id));

CREATE POLICY "pmt_delete" ON public.project_media_types
  FOR DELETE TO authenticated
  USING (public.can_view_project(auth.uid(), project_id));

CREATE INDEX idx_pmt_project ON public.project_media_types(project_id);

INSERT INTO public.project_media_types (project_id, media_type_id)
SELECT id, media_type_id FROM public.projects WHERE media_type_id IS NOT NULL
ON CONFLICT DO NOTHING;