ALTER POLICY "Anyone can submit registrations" ON public.pending_registrations
  WITH CHECK (
    status = 'pending'::text
    AND (requested_role IS NULL OR requested_role IN ('membro'::app_role, 'cliente'::app_role))
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND rejection_reason IS NULL
  );

ALTER POLICY "fer_insert_public" ON public.financial_entry_requests
  WITH CHECK (
    status = 'pendente'::text
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND review_notes IS NULL
    AND created_entry_id IS NULL
  );

ALTER POLICY "tr_insert_public" ON public.ticket_requests
  WITH CHECK (
    status = 'pendente'::text
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND created_project_id IS NULL
    AND internal_notes IS NULL
    AND review_notes IS NULL
  );