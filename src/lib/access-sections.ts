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

type RuleInput = {
  startStageOrder: number | null;
  doneStatusIds: Set<string>;
  statusOrder: Map<string, number>;
  finalStatusIds: Set<string>;
};

export function buildStageRules({ startStageOrder, doneStatusIds, statusOrder, finalStatusIds }: RuleInput) {
  const isStarted = (statusId: string | null | undefined) => {
    if (startStageOrder === null || !statusId) return true;
    return (statusOrder.get(statusId) ?? 0) >= startStageOrder;
  };
  const isDone = (statusId: string | null | undefined) => {
    if (!statusId) return false;
    if (doneStatusIds.size > 0) return doneStatusIds.has(statusId);
    return finalStatusIds.has(statusId);
  };
  return { isStarted, isDone };
}

/**
 * Regras de fase de um usuário específico (usado quando gestores filtram o
 * dashboard por membro). Sem userId, cai nas regras do próprio usuário logado.
 */
export function useStageRulesFor(userId: string | null | undefined) {
  const own = useStageRules();
  const { statusOrder, finalStatusIds } = useAccess();

  const { data } = useQuery({
    queryKey: ["stage-rules-for", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: us } = await supabase.from("user_specialties").select("specialty_id").eq("user_id", userId!);
      const ids = (us ?? []).map((r: { specialty_id: string }) => r.specialty_id);
      if (ids.length === 0) return { start: null as number | null, done: [] as string[] };
      const { data: rules } = await supabase
        .from("specialty_stage_rules")
        .select("status_id, is_start, is_done")
        .in("specialty_id", ids);
      return {
        start: (rules ?? []).filter((r) => r.is_start).map((r) => r.status_id),
        done: (rules ?? []).filter((r) => r.is_done).map((r) => r.status_id),
      } as { start: string[] | null; done: string[] };
    },
  });

  if (!userId || !data) return own;

  const startIds = Array.isArray(data.start) ? data.start : [];
  const startStageOrder = startIds.length
    ? Math.min(...startIds.map((id) => statusOrder.get(id) ?? 0))
    : null;
  return buildStageRules({
    startStageOrder,
    doneStatusIds: new Set(data.done),
    statusOrder,
    finalStatusIds,
  });
}


