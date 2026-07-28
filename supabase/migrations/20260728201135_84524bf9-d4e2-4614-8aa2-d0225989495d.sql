
CREATE TABLE public.financial_entry_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  requester_notes text,
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  entry_date date NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  category_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  receipt_path text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_entry_id uuid REFERENCES public.financial_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.financial_entry_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_entry_requests TO authenticated;
GRANT ALL ON public.financial_entry_requests TO service_role;

ALTER TABLE public.financial_entry_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fer_insert_public"
  ON public.financial_entry_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pendente');

CREATE POLICY "fer_select_manager"
  ON public.financial_entry_requests
  FOR SELECT
  TO authenticated
  USING (public.is_manager(auth.uid()));

CREATE POLICY "fer_update_manager"
  ON public.financial_entry_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_manager(auth.uid()))
  WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "fer_delete_manager"
  ON public.financial_entry_requests
  FOR DELETE
  TO authenticated
  USING (public.is_manager(auth.uid()));

CREATE TRIGGER trg_fer_updated_at
  BEFORE UPDATE ON public.financial_entry_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Storage policies for financial-receipts bucket: allow anon uploads to pending/ prefix, managers can read.
CREATE POLICY "fer_receipts_public_insert"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'financial-receipts'
    AND (storage.foldername(name))[1] = 'pending'
  );

CREATE POLICY "fer_receipts_manager_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'financial-receipts'
    AND public.is_manager(auth.uid())
  );
