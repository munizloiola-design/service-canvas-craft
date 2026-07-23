ALTER TABLE public.app_branding
  ADD COLUMN IF NOT EXISTS sidebar_color text,
  ADD COLUMN IF NOT EXISTS background_image text,
  ADD COLUMN IF NOT EXISTS login_box_position text DEFAULT 'right',
  ADD COLUMN IF NOT EXISTS welcome_title text DEFAULT 'Como deseja entrar?',
  ADD COLUMN IF NOT EXISTS welcome_subtitle text DEFAULT 'Escolha o tipo de acesso.';

ALTER TABLE public.app_branding
  DROP CONSTRAINT IF EXISTS app_branding_login_box_position_check;
ALTER TABLE public.app_branding
  ADD CONSTRAINT app_branding_login_box_position_check
  CHECK (login_box_position IN ('left','center','right'));