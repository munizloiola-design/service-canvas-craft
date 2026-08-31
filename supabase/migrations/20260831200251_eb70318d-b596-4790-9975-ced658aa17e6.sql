CREATE OR REPLACE FUNCTION public.set_priority_alta_on_correcao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _alta_id uuid;
  _alta_level int;
  _current_level int;
BEGIN
  -- Only when the stage actually changes
  IF NEW.status_id IS NULL OR NEW.status_id IS NOT DISTINCT FROM OLD.status_id THEN
    RETURN NEW;
  END IF;

  -- Is the new stage called "Correção"?
  IF NOT EXISTS (
    SELECT 1 FROM public.workflow_statuses ws
    WHERE ws.id = NEW.status_id
      AND lower(unaccent_safe(ws.name)) = 'correcao'
  ) THEN
    RETURN NEW;
  END IF;

  -- Find the "Alta" priority
  SELECT p.id, p.level INTO _alta_id, _alta_level
  FROM public.priorities p
  WHERE lower(unaccent_safe(p.name)) = 'alta'
  ORDER BY p.level
  LIMIT 1;

  IF _alta_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Current priority level (null treated as lowest)
  SELECT p.level INTO _current_level
  FROM public.priorities p
  WHERE p.id = NEW.priority_id;

  -- Only raise, never lower (Urgente stays Urgente)
  IF _current_level IS NULL OR _current_level < _alta_level THEN
    NEW.priority_id := _alta_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_priority_alta_on_correcao ON public.projects;
CREATE TRIGGER trg_priority_alta_on_correcao
BEFORE UPDATE OF status_id ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.set_priority_alta_on_correcao();