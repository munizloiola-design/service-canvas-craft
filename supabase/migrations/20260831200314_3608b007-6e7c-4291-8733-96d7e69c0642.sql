CREATE OR REPLACE FUNCTION public.set_priority_alta_on_correcao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _alta_id uuid;
  _alta_level int;
  _current_level int;
BEGIN
  IF NEW.status_id IS NULL OR NEW.status_id IS NOT DISTINCT FROM OLD.status_id THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workflow_statuses ws
    WHERE ws.id = NEW.status_id
      AND lower(unaccent_safe(ws.name)) = 'correcao'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT p.id, p.level INTO _alta_id, _alta_level
  FROM public.priorities p
  WHERE lower(unaccent_safe(p.name)) = 'alta'
  ORDER BY p.level
  LIMIT 1;

  IF _alta_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.level INTO _current_level
  FROM public.priorities p
  WHERE p.id = NEW.priority_id;

  IF _current_level IS NULL OR _current_level < _alta_level THEN
    NEW.priority_id := _alta_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_priority_alta_on_correcao() FROM public, anon, authenticated;