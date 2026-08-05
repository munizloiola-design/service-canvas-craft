CREATE POLICY projects_select_creator
ON public.projects
FOR SELECT
TO authenticated
USING (created_by = auth.uid());