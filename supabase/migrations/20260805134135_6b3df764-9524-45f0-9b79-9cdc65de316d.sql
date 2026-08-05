REVOKE EXECUTE ON FUNCTION public.has_menu_access(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_menu_access(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_menu_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_menu_access(uuid, text) TO service_role;