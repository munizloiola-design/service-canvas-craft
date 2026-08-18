import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

/**
 * Regras de fase por especialidade (Perfis e Acessos):
 * - fase de início: demandas em fases anteriores somem da tela e das contagens;
 * - fases de conclusão: o que a especialidade considera entregue (sem regra,
 *   vale o "final" global do cadastro de etapas).
 */
export function useStageRules() {
  const { startStageOrder, doneStatusIds, statusOrder, finalStatusIds, isPrivileged } = useAccess();

  const isStarted = (statusId: string | null | undefined) => {
    if (isPrivileged || startStageOrder === null) return true;
    if (!statusId) return true;
    return (statusOrder.get(statusId) ?? 0) >= startStageOrder;
  };

  const isDone = (statusId: string | null | undefined) => {
    if (!statusId) return false;
    if (!isPrivileged && doneStatusIds.size > 0) return doneStatusIds.has(statusId);
    return finalStatusIds.has(statusId);
  };

  return { isStarted, isDone };
}


