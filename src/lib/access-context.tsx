import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { sectionKey } from "@/lib/access-registry";

type Ctx = {
  loading: boolean;
  areaIds: string[];
  specialtyIds: string[];
  allowedMenuKeys: Set<string>;
  fieldView: Set<string>;
  fieldEdit: Set<string>;
  isPrivileged: boolean;
  menuAllowed: (key: string) => boolean;
  canViewField: (key: string) => boolean;
  canEditField: (key: string) => boolean;
  canViewSection: (menu: string, section: string) => boolean;
  canEditSection: (menu: string, section: string) => boolean;
  refresh: () => Promise<void>;
};


const AccessContext = createContext<Ctx | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  const { user, isManager, isMaster } = useAuth();
  const isPrivileged = isManager || isMaster;
  const [state, setState] = useState({
    loading: true,
    areaIds: [] as string[],
    specialtyIds: [] as string[],
    allowedMenuKeys: new Set<string>(),
    fieldView: new Set<string>(),
    fieldEdit: new Set<string>(),
  });

  const load = async () => {
    if (!user) {
      setState({ loading: false, areaIds: [], specialtyIds: [], allowedMenuKeys: new Set(), fieldView: new Set(), fieldEdit: new Set() });
      return;
    }
    const { data: us } = await supabase
      .from("user_specialties")
      .select("specialty_id, provider_specialties(area_id)")
      .eq("user_id", user.id);
    const specialtyIds = (us ?? []).map((r: any) => r.specialty_id as string);
    const areaIds = Array.from(new Set((us ?? []).map((r: any) => r.provider_specialties?.area_id).filter(Boolean) as string[]));

    let allowedMenuKeys = new Set<string>();
    let fieldView = new Set<string>();
    let fieldEdit = new Set<string>();

    if (areaIds.length > 0) {
      const { data: menus } = await supabase.from("area_menu_visibility").select("menu_key").in("area_id", areaIds);
      allowedMenuKeys = new Set((menus ?? []).map((m: { menu_key: string }) => m.menu_key));
    }
    if (specialtyIds.length > 0) {
      const { data: fields } = await supabase
        .from("specialty_field_visibility")
        .select("field_key, can_view, can_edit")
        .in("specialty_id", specialtyIds);
      for (const f of fields ?? []) {
        if (f.can_view) fieldView.add(f.field_key);
        if (f.can_edit) fieldEdit.add(f.field_key);
      }
    }

    setState({ loading: false, areaIds, specialtyIds, allowedMenuKeys, fieldView, fieldEdit });
  };

  useEffect(() => { void load(); }, [user?.id]);

  // Controle exclusivo por Perfis e Acessos (áreas/especialidades).
  // Admins/gerentes/masters recebem acesso por herdarem a especialidade "Administração › Total".
  const menuAllowed = (key: string) => state.allowedMenuKeys.has(key);
  const canViewField = (key: string) => state.fieldView.has(key);
  const canEditField = (key: string) => state.fieldEdit.has(key);

  // Seções (abas) de um menu. Fallback permissivo POR MENU: se a especialidade
  // não tem nenhuma regra para aquele menu, nada é escondido nele.
  const hasRulesFor = (menu: string) => {
    const prefix = `menu:${menu}#`;
    return Array.from(state.fieldView).some((k) => k.startsWith(prefix))
      || Array.from(state.fieldEdit).some((k) => k.startsWith(prefix));
  };
  const canViewSection = (menu: string, section: string) =>
    !hasRulesFor(menu) || state.fieldView.has(sectionKey(menu, section));
  const canEditSection = (menu: string, section: string) =>
    !hasRulesFor(menu) || state.fieldEdit.has(sectionKey(menu, section));

  return (
    <AccessContext.Provider value={{ ...state, isPrivileged, menuAllowed, canViewField, canEditField, canViewSection, canEditSection, refresh: load }}>

      {children}
    </AccessContext.Provider>
  );
}

export function useAccess() {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error("useAccess must be inside AccessProvider");
  return ctx;
}
