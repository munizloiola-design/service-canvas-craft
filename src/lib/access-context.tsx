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
  /** Ordem (sort_order) da fase de início da especialidade; null = sem regra. */
  startStageOrder: number | null;
  /** Fases que a especialidade considera como entregue. */
  doneStatusIds: Set<string>;
  /** sort_order de cada etapa do fluxo. */
  statusOrder: Map<string, number>;
  /** Etapas marcadas como finais no cadastro (fallback global). */
  finalStatusIds: Set<string>;
  isPrivileged: boolean;
  menuAllowed: (key: string) => boolean;
  canViewField: (key: string) => boolean;
  canEditField: (key: string) => boolean;
  canViewSection: (menu: string, section: string) => boolean;
  hasSectionRules: (menu: string) => boolean;
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
    startStageOrder: null as number | null,
    doneStatusIds: new Set<string>(),
    statusOrder: new Map<string, number>(),
    finalStatusIds: new Set<string>(),
  });


  const load = async () => {
    const empty = {
      startStageOrder: null as number | null,
      doneStatusIds: new Set<string>(),
      statusOrder: new Map<string, number>(),
      finalStatusIds: new Set<string>(),
    };
    if (!user) {
      setState({ loading: false, areaIds: [], specialtyIds: [], allowedMenuKeys: new Set(), fieldView: new Set(), fieldEdit: new Set(), ...empty });
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

    // Regras de fase por especialidade (fase de início e fases que contam como concluídas)
    const { data: sts } = await supabase.from("workflow_statuses").select("id, sort_order, is_final");
    const statusOrder = new Map<string, number>((sts ?? []).map((s: any) => [s.id as string, (s.sort_order ?? 0) as number]));
    const finalStatusIds = new Set<string>((sts ?? []).filter((s: any) => s.is_final).map((s: any) => s.id as string));

    let startStageOrder: number | null = null;
    const doneStatusIds = new Set<string>();
    if (specialtyIds.length > 0) {
      const { data: rules } = await supabase
        .from("specialty_stage_rules")
        .select("status_id, is_start, is_done")
        .in("specialty_id", specialtyIds);
      for (const r of rules ?? []) {
        if (r.is_done) doneStatusIds.add(r.status_id);
        if (r.is_start) {
          const ord = statusOrder.get(r.status_id) ?? 0;
          // Com várias especialidades, vale a fase de início mais permissiva.
          startStageOrder = startStageOrder === null ? ord : Math.min(startStageOrder, ord);
        }
      }
    }

    setState({ loading: false, areaIds, specialtyIds, allowedMenuKeys, fieldView, fieldEdit, startStageOrder, doneStatusIds, statusOrder, finalStatusIds });
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
    <AccessContext.Provider value={{ ...state, isPrivileged, menuAllowed, canViewField, canEditField, canViewSection, canEditSection, hasSectionRules: hasRulesFor, refresh: load }}>

      {children}
    </AccessContext.Provider>
  );
}

export function useAccess() {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error("useAccess must be inside AccessProvider");
  return ctx;
}
