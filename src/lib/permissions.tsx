import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth-context";

export type Resource = "dashboard" | "projects" | "financeiro" | "orcamento" | "equipamentos" | "team" | "cadastros" | "calendario" | "facebook" | "diguinho" | "integracoes" | "tickets";
export type Action = "view" | "create" | "edit" | "delete";

export type Permission = { role: AppRole; resource: string; action: string };

type Ctx = {
  permissions: Permission[];
  loading: boolean;
  can: (resource: Resource, action: Action) => boolean;
  refresh: () => Promise<void>;
};

const PermissionsContext = createContext<Ctx | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { roles, user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.from("role_permissions").select("role, resource, action");
    setPermissions((data ?? []) as Permission[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
    else { setPermissions([]); setLoading(false); }
  }, [user]);

  const can = (resource: Resource, action: Action) => {
    if (!user) return false;
    return permissions.some((p) => roles.includes(p.role as AppRole) && p.resource === resource && p.action === action);
  };

  return (
    <PermissionsContext.Provider value={{ permissions, loading, can, refresh: load }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error("usePermissions must be inside PermissionsProvider");
  return ctx;
}

export function useCan(resource: Resource, action: Action) {
  return usePermissions().can(resource, action);
}
