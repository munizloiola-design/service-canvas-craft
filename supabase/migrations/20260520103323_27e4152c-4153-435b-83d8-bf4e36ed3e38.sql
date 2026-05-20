
-- 1) Migrar usuários admin_master -> admin (evitando duplicar caso já tenham admin)
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::app_role
FROM public.user_roles
WHERE role::text = 'admin_master'
  AND user_id NOT IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role);

DELETE FROM public.user_roles WHERE role::text = 'admin_master';

-- 2) Redefinir is_master para apontar para admin (mantém compatibilidade de policies)
CREATE OR REPLACE FUNCTION public.is_master(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_uid, 'admin'::app_role)
$$;

-- 3) Ajustar role_rank: admin_master vira o mesmo rank de admin
CREATE OR REPLACE FUNCTION public.role_rank(_role app_role)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE _role
    WHEN 'admin_master'::app_role THEN 3
    WHEN 'admin'::app_role THEN 3
    WHEN 'gerente'::app_role THEN 2
    WHEN 'membro'::app_role THEN 1
    WHEN 'cliente'::app_role THEN 0
    ELSE -1 END
$$;

-- 4) handle_new_user: primeiro usuário vira admin (não mais admin_master)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    (CASE WHEN is_first THEN 'admin' ELSE 'membro' END)::app_role
  );
  RETURN NEW;
END $$;
