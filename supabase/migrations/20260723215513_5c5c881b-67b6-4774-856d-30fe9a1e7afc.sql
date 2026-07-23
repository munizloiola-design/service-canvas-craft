
CREATE TABLE public.contact_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_categories TO authenticated;
GRANT ALL ON public.contact_categories TO service_role;
ALTER TABLE public.contact_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_categories_select_internal" ON public.contact_categories
  FOR SELECT TO authenticated
  USING (NOT public.is_client_user(auth.uid()));
CREATE POLICY "contact_categories_insert_managers" ON public.contact_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager(auth.uid()));
CREATE POLICY "contact_categories_update_managers" ON public.contact_categories
  FOR UPDATE TO authenticated
  USING (public.is_manager(auth.uid()))
  WITH CHECK (public.is_manager(auth.uid()));
CREATE POLICY "contact_categories_delete_managers" ON public.contact_categories
  FOR DELETE TO authenticated
  USING (public.is_manager(auth.uid()));

CREATE TABLE public.partner_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  profession text,
  phone text,
  email text,
  category_id uuid REFERENCES public.contact_categories(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_contacts TO authenticated;
GRANT ALL ON public.partner_contacts TO service_role;
ALTER TABLE public.partner_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_contacts_select_internal" ON public.partner_contacts
  FOR SELECT TO authenticated
  USING (NOT public.is_client_user(auth.uid()));
CREATE POLICY "partner_contacts_insert_internal" ON public.partner_contacts
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_client_user(auth.uid()));
CREATE POLICY "partner_contacts_update_internal" ON public.partner_contacts
  FOR UPDATE TO authenticated
  USING (NOT public.is_client_user(auth.uid()))
  WITH CHECK (NOT public.is_client_user(auth.uid()));
CREATE POLICY "partner_contacts_delete_internal" ON public.partner_contacts
  FOR DELETE TO authenticated
  USING (NOT public.is_client_user(auth.uid()));

CREATE INDEX partner_contacts_category_idx ON public.partner_contacts(category_id);
CREATE INDEX partner_contacts_name_idx ON public.partner_contacts(lower(name));

CREATE TRIGGER partner_contacts_updated_at
  BEFORE UPDATE ON public.partner_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
