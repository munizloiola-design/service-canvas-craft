import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const PROJECT_FIELDS = [
  { key: "budget", label: "Orçamento" },
  { key: "client_id", label: "Cliente" },
  { key: "due_date", label: "Prazo" },
  { key: "post_date", label: "Data de postagem" },
  { key: "priority", label: "Prioridade" },
  { key: "description", label: "Descrição" },
  { key: "notes", label: "Notas internas" },
  { key: "reference_links", label: "Links de referência" },
  { key: "deliverable_path", label: "Entregável" },
  { key: "client_feedback", label: "Feedback do cliente" },
  { key: "media_type", label: "Tipo de mídia" },
] as const;
export type ProjectFieldKey = (typeof PROJECT_FIELDS)[number]["key"];

type Ctx = {
  hidden: Set<string>;
  loading: boolean;
  canSee: (field: ProjectFieldKey) => boolean;
};

const FieldVisibilityContext = createContext<Ctx | null>(null);

export function FieldVisibilityProvider({ children }: { children: ReactNode }) {
  const { user, isManager } = useAuth();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || isManager) {
      setHidden(new Set());
      setLoading(false);
      return;
    }
    (async () => {
      const { data: ufs } = await supabase.from("user_functions").select("function_id").eq("user_id", user.id);
      const fnIds = (ufs ?? []).map((u: { function_id: string }) => u.function_id);
      if (fnIds.length === 0) {
        setHidden(new Set());
        setLoading(false);
        return;
      }
      const { data: vis } = await supabase
        .from("function_field_visibility")
        .select("field_key, visible, function_id")
        .in("function_id", fnIds);
      // Hide field only if ALL of the user's functions mark it as hidden
      const perField: Record<string, boolean> = {};
      for (const row of vis ?? []) {
        const k = row.field_key as string;
        perField[k] = perField[k] || !!row.visible;
      }
      const h = new Set<string>();
      for (const [k, anyVisible] of Object.entries(perField)) {
        if (!anyVisible) h.add(k);
      }
      setHidden(h);
      setLoading(false);
    })();
  }, [user, isManager]);

  const canSee = (field: ProjectFieldKey) => isManager || !hidden.has(field);

  return (
    <FieldVisibilityContext.Provider value={{ hidden, loading, canSee }}>
      {children}
    </FieldVisibilityContext.Provider>
  );
}

export function useFieldVisibility() {
  const ctx = useContext(FieldVisibilityContext);
  if (!ctx) throw new Error("useFieldVisibility must be inside FieldVisibilityProvider");
  return ctx;
}
