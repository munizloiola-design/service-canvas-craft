import { createContext, useContext, type ReactNode } from "react";
import { useAccess } from "@/lib/access-context";

// Compat layer: PROJECT_FIELDS + useFieldVisibility continuam existindo,
// mas agora usam a nova hierarquia (Áreas/Especialidades) via AccessProvider.
export const PROJECT_FIELDS = [
  { key: "budget", label: "Orçamento" },
  { key: "client_id", label: "Cliente" },
  { key: "due_date", label: "Prazo" },
  { key: "post_date", label: "Data de postagem" },
  { key: "priority", label: "Prioridade" },
  { key: "description", label: "Descrição" },
  { key: "notes", label: "Direção de arte" },
  { key: "caption", label: "Legenda" },
  { key: "reference_links", label: "Links de referência" },
  { key: "deliverable_path", label: "Entregável" },
  { key: "final_link", label: "Arquivo ou link finalizado" },
  { key: "client_feedback", label: "Feedback do cliente" },
  { key: "media_type", label: "Tipo de mídia" },
] as const;
export type ProjectFieldKey = (typeof PROJECT_FIELDS)[number]["key"];

type Ctx = {
  loading: boolean;
  canSee: (field: ProjectFieldKey) => boolean;
  canEdit: (field: ProjectFieldKey) => boolean;
};

const FieldVisibilityContext = createContext<Ctx | null>(null);

export function FieldVisibilityProvider({ children }: { children: ReactNode }) {
  const access = useAccess();
  const value: Ctx = {
    loading: access.loading,
    // Sem regras cadastradas para a especialidade, nada é escondido.
    canSee: (f) => access.fieldView.size === 0 || access.canViewField(f),
    canEdit: (f) => access.fieldEdit.size === 0 || access.canEditField(f),
  };
  return <FieldVisibilityContext.Provider value={value}>{children}</FieldVisibilityContext.Provider>;
}

export function useFieldVisibility() {
  const ctx = useContext(FieldVisibilityContext);
  if (!ctx) throw new Error("useFieldVisibility must be inside FieldVisibilityProvider");
  return ctx;
}
