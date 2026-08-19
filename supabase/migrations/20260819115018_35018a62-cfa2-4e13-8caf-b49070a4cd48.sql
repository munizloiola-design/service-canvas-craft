ALTER TABLE public.provider_specialties
  ADD COLUMN IF NOT EXISTS date_basis text NOT NULL DEFAULT 'due';

ALTER TABLE public.provider_specialties
  DROP CONSTRAINT IF EXISTS provider_specialties_date_basis_check;

ALTER TABLE public.provider_specialties
  ADD CONSTRAINT provider_specialties_date_basis_check CHECK (date_basis IN ('due','post'));