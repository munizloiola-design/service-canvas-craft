CREATE TABLE public.specialty_stage_rules (
  specialty_id uuid NOT NULL REFERENCES public.provider_specialties(id) ON DELETE CASCADE,
  status_id uuid NOT NULL REFERENCES public.workflow_statuses(id) ON DELETE CASCADE,
  is_start boolean NOT NULL DEFAULT false,
  is_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (specialty_id, status_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.specialty_stage_rules TO authenticated;
GRANT ALL ON public.specialty_stage_rules TO service_role;

ALTER TABLE public.specialty_stage_rules ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX specialty_stage_rules_one_start
  ON public.specialty_stage_rules (specialty_id)
  WHERE is_start;

CREATE POLICY "internal users can read stage rules"
  ON public.specialty_stage_rules FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "managers manage stage rules"
  ON public.specialty_stage_rules FOR ALL
  TO authenticated
  USING (public.is_manager(auth.uid()))
  WITH CHECK (public.is_manager(auth.uid()));

CREATE TRIGGER trg_ssr_updated
  BEFORE UPDATE ON public.specialty_stage_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();