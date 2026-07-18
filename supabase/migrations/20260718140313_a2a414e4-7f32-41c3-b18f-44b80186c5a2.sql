ALTER TABLE public.app_branding
  ADD COLUMN IF NOT EXISTS theme_json jsonb NOT NULL DEFAULT jsonb_build_object(
    'primary', '#1a936f',
    'accent',  '#0f766e',
    'background', '#f4f6f8',
    'card', '#ffffff',
    'chart1', '#1a936f',
    'chart2', '#38bdf8',
    'chart3', '#f97316',
    'chart4', '#a855f7',
    'chart5', '#ec4899',
    'chart6', '#eab308'
  );