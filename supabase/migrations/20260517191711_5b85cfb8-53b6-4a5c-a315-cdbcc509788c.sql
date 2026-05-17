
CREATE TABLE public.project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_comments_project ON public.project_comments(project_id, created_at);

ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pc_select_scoped" ON public.project_comments
  FOR SELECT TO authenticated
  USING (
    public.is_manager(auth.uid())
    OR public.is_project_assignee(auth.uid(), project_id)
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_comments.project_id
        AND p.client_id IS NOT NULL
        AND public.has_client_access(auth.uid(), p.client_id)
    )
  );

CREATE POLICY "pc_insert_scoped" ON public.project_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      public.is_manager(auth.uid())
      OR public.is_project_assignee(auth.uid(), project_id)
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_comments.project_id
          AND p.client_id IS NOT NULL
          AND public.has_client_access(auth.uid(), p.client_id)
      )
    )
  );

CREATE POLICY "pc_delete_own_or_mgr" ON public.project_comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_manager(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.project_comments;
ALTER TABLE public.project_comments REPLICA IDENTITY FULL;
