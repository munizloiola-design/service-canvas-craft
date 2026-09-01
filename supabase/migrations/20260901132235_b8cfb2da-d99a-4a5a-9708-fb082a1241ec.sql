CREATE TABLE public.project_deliverables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_deliverables_project ON public.project_deliverables(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_deliverables TO authenticated;
GRANT ALL ON public.project_deliverables TO service_role;

ALTER TABLE public.project_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deliverables_select" ON public.project_deliverables
FOR SELECT TO authenticated
USING (
  public.can_view_project(auth.uid(), project_id)
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
      AND p.client_id IS NOT NULL
      AND public.has_client_access(auth.uid(), p.client_id)
  )
);

CREATE POLICY "deliverables_insert" ON public.project_deliverables
FOR INSERT TO authenticated
WITH CHECK (
  public.is_manager(auth.uid())
  OR public.is_project_assignee(auth.uid(), project_id)
);

CREATE POLICY "deliverables_delete" ON public.project_deliverables
FOR DELETE TO authenticated
USING (
  public.is_manager(auth.uid())
  OR public.is_project_assignee(auth.uid(), project_id)
);

INSERT INTO public.project_deliverables (project_id, file_name, file_path)
SELECT p.id,
       regexp_replace(p.deliverable_path, '^.*/', ''),
       p.deliverable_path
FROM public.projects p
WHERE p.deliverable_path IS NOT NULL AND p.deliverable_path <> '';

CREATE OR REPLACE FUNCTION public.apply_auto_priority()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer := 0;
BEGIN
  WITH pr AS (
    SELECT
      (SELECT id FROM public.priorities WHERE lower(public.unaccent_safe(name)) = 'urgente' ORDER BY level DESC LIMIT 1) AS urgente,
      (SELECT id FROM public.priorities WHERE lower(public.unaccent_safe(name)) = 'alta' ORDER BY level DESC LIMIT 1) AS alta,
      (SELECT id FROM public.priorities WHERE lower(public.unaccent_safe(name)) = 'media' ORDER BY level DESC LIMIT 1) AS media,
      (SELECT id FROM public.priorities WHERE lower(public.unaccent_safe(name)) = 'baixa' ORDER BY level DESC LIMIT 1) AS baixa
  ),
  target AS (
    SELECT p.id,
           CASE
             WHEN (COALESCE(p.post_date, p.due_date) - CURRENT_DATE) <= 1 THEN pr.urgente
             WHEN (COALESCE(p.post_date, p.due_date) - CURRENT_DATE) <= 5 THEN pr.alta
             WHEN (COALESCE(p.post_date, p.due_date) - CURRENT_DATE) <= 10 THEN pr.media
             ELSE pr.baixa
           END AS new_priority
    FROM public.projects p
    CROSS JOIN pr
    WHERE COALESCE(p.post_date, p.due_date) IS NOT NULL
      AND (
        p.status_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM public.workflow_statuses ws
          WHERE ws.id = p.status_id AND ws.is_final = true
        )
      )
  ),
  upd AS (
    UPDATE public.projects p
       SET priority_id = t.new_priority
      FROM target t
      LEFT JOIN public.priorities np ON np.id = t.new_priority
     WHERE p.id = t.id
       AND t.new_priority IS NOT NULL
       AND (
         p.priority_id IS NULL
         OR COALESCE((SELECT level FROM public.priorities cp WHERE cp.id = p.priority_id), -1) < np.level
       )
    RETURNING 1
  )
  SELECT count(*) INTO _count FROM upd;

  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_auto_priority() FROM public, anon, authenticated;