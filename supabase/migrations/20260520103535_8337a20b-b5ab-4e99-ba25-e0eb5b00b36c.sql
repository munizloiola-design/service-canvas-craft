
CREATE OR REPLACE FUNCTION public.unaccent_safe(_t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT translate(_t,
    'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')
$$;

CREATE OR REPLACE FUNCTION public.slugify(_t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT regexp_replace(
           regexp_replace(lower(public.unaccent_safe(_t)), '[^a-z0-9]+', '_', 'g'),
           '(^_+|_+$)', '', 'g'
         )
$$;

CREATE OR REPLACE FUNCTION public.sync_project_role_to_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text;
  v_base text;
  v_n int := 0;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.collaborator_functions WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  v_base := public.slugify(NEW.name);
  IF v_base IS NULL OR v_base = '' THEN v_base := 'funcao'; END IF;
  v_key := v_base;
  WHILE EXISTS (
    SELECT 1 FROM public.collaborator_functions WHERE key = v_key AND id <> NEW.id
  ) LOOP
    v_n := v_n + 1;
    v_key := v_base || '_' || v_n;
  END LOOP;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.collaborator_functions (id, name, key, sort_order)
    VALUES (NEW.id, NEW.name, v_key, COALESCE((SELECT MAX(sort_order)+1 FROM public.collaborator_functions), 0))
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, key = EXCLUDED.key;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.collaborator_functions
       SET name = NEW.name, key = v_key
     WHERE id = NEW.id;
    IF NOT FOUND THEN
      INSERT INTO public.collaborator_functions (id, name, key, sort_order)
      VALUES (NEW.id, NEW.name, v_key, COALESCE((SELECT MAX(sort_order)+1 FROM public.collaborator_functions), 0));
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_project_role_to_function ON public.project_roles;
CREATE TRIGGER trg_sync_project_role_to_function
AFTER INSERT OR UPDATE OR DELETE ON public.project_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_project_role_to_function();

DO $$
DECLARE r RECORD; v_key text; v_base text; v_n int;
BEGIN
  FOR r IN SELECT id, name FROM public.project_roles LOOP
    v_base := public.slugify(r.name);
    IF v_base IS NULL OR v_base = '' THEN v_base := 'funcao'; END IF;
    v_key := v_base; v_n := 0;
    WHILE EXISTS (SELECT 1 FROM public.collaborator_functions WHERE key = v_key AND id <> r.id) LOOP
      v_n := v_n + 1; v_key := v_base || '_' || v_n;
    END LOOP;

    INSERT INTO public.collaborator_functions (id, name, key, sort_order)
    VALUES (r.id, r.name, v_key, COALESCE((SELECT MAX(sort_order)+1 FROM public.collaborator_functions), 0))
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
  END LOOP;

  DELETE FROM public.collaborator_functions cf
   WHERE NOT EXISTS (SELECT 1 FROM public.project_roles pr WHERE pr.id = cf.id);
END $$;
