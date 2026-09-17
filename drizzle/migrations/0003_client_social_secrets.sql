CREATE TABLE public.client_social_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  entry_id text NOT NULL,
  senha text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, entry_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_social_secrets TO authenticated;
GRANT ALL ON public.client_social_secrets TO service_role;

ALTER TABLE public.client_social_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers_select_social_secrets" ON public.client_social_secrets
FOR SELECT TO authenticated
USING (public.is_manager(auth.uid()));

CREATE POLICY "managers_insert_social_secrets" ON public.client_social_secrets
FOR INSERT TO authenticated
WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "managers_update_social_secrets" ON public.client_social_secrets
FOR UPDATE TO authenticated
USING (public.is_manager(auth.uid()))
WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "managers_delete_social_secrets" ON public.client_social_secrets
FOR DELETE TO authenticated
USING (public.is_manager(auth.uid()));