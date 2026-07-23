
-- Restrict assignee direct UPDATE on projects; expose a narrow RPC instead.
DROP POLICY IF EXISTS projects_update_assignee ON public.projects;

CREATE OR REPLACE FUNCTION public.update_project_schedule(
  _id uuid,
  _status_id uuid DEFAULT NULL,
  _due_date date DEFAULT NULL,
  _post_date date DEFAULT NULL,
  _clear_due boolean DEFAULT false,
  _clear_post boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_manager(auth.uid()) OR public.is_project_assignee(auth.uid(), _id)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.projects
     SET status_id = COALESCE(_status_id, status_id),
         due_date  = CASE WHEN _clear_due THEN NULL ELSE COALESCE(_due_date, due_date) END,
         post_date = CASE WHEN _clear_post THEN NULL ELSE COALESCE(_post_date, post_date) END,
         updated_at = now()
   WHERE id = _id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_project_schedule(uuid, uuid, date, date, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_project_schedule(uuid, uuid, date, date, boolean, boolean) TO authenticated;
