import { useAccess } from "@/lib/access-context";

/**
 * Gate de seções (abas) de um menu, controlado em Perfis e Acessos →
 * Especialidade. Sem regras cadastradas, tudo é liberado.
 */
export function useSectionGate(menu: string) {
  const { canViewSection, canEditSection } = useAccess();
  const can = (section: string) => canViewSection(menu, section);
  const canEdit = (section: string) => canEditSection(menu, section);
  /** Primeira aba liberada da lista (para usar como aba inicial). */
  const first = (sections: string[], fallback?: string) =>
    sections.find((s) => can(s)) ?? fallback ?? sections[0];
  return { can, canEdit, first };
}

/** Gate das fases (etapas) do Kanban de Demandas. */
export function useStageGate() {
  const { canViewSection } = useAccess();
  return (statusId: string | null | undefined) =>
    !statusId || canViewSection("/projects", `stage:${statusId}`);
}

