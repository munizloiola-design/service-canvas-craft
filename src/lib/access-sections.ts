import { useMemo } from "react";
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

/** Gate das fases (etapas) exibidas no Calendário. */
export function useCalendarStageGate() {
  const { canViewSection } = useAccess();
  return (statusId: string | null | undefined) =>
    !statusId || canViewSection("/calendario", `stage:${statusId}`);
}


/**
 * Regras de fase por especialidade (Perfis e Acessos):
 * - fase de início: demandas em fases anteriores somem da tela e das contagens;
 * - fases de conclusão: o que a especialidade considera entregue (sem regra,
 *   vale o "final" global do cadastro de etapas).
 */
export function useStageRules() {
  const { startStageOrder, doneStatusIds, statusOrder, finalStatusIds, isPrivileged } = useAccess();

  return useMemo(() => {
    const base = buildStageRules({ startStageOrder, doneStatusIds, statusOrder, finalStatusIds });

    const isStarted = (statusId: string | null | undefined) => {
      if (isPrivileged) return true;
      return base.isStarted(statusId);
    };

    const isDone = (statusId: string | null | undefined) => {
      if (!statusId) return false;
      if (!isPrivileged) return base.isDone(statusId);
      return finalStatusIds.has(statusId);
    };

    return { ...base, isStarted, isDone };
  }, [startStageOrder, doneStatusIds, statusOrder, finalStatusIds, isPrivileged]);
}

export type DateBasis = "due" | "post";

type RuleInput = {
  startStageOrder: number | null;
  doneStatusIds: Set<string>;
  statusOrder: Map<string, number>;
  finalStatusIds: Set<string>;
  dateBases?: DateBasis[];
};

export function buildStageRules({
  startStageOrder,
  doneStatusIds,
  statusOrder,
  finalStatusIds,
  dateBases,
}: RuleInput) {
  // "Concluído" vale da fase marcada em diante: usa a menor ordem entre as
  // fases marcadas como conclusão da especialidade.
  const doneFromOrder = doneStatusIds.size
    ? Math.min(...Array.from(doneStatusIds).map((id) => statusOrder.get(id) ?? 0))
    : null;

  const bases: DateBasis[] = dateBases && dateBases.length ? dateBases : ["due"];

  const isStarted = (statusId: string | null | undefined) => {
    if (startStageOrder === null || !statusId) return true;
    return (statusOrder.get(statusId) ?? 0) >= startStageOrder;
  };
  const isDone = (statusId: string | null | undefined) => {
    if (!statusId) return false;
    if (finalStatusIds.has(statusId)) return true;
    if (doneFromOrder === null) return false;
    return (statusOrder.get(statusId) ?? 0) >= doneFromOrder;
  };
  /** Datas de referência da demanda conforme a(s) especialidade(s). */
  const refDates = (p: { due_date?: string | null; post_date?: string | null }) => {
    const out: string[] = [];
    for (const b of bases) {
      const primary = b === "post" ? p.post_date : p.due_date;
      const fallback = b === "post" ? p.due_date : p.post_date;
      const d = primary ?? fallback;
      if (d) out.push(d);
    }
    return Array.from(new Set(out));
  };
  return { isStarted, isDone, refDates, dateBases: bases };
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
      const { data: us } = await supabase
        .from("user_specialties")
        .select("specialty_id, provider_specialties(date_basis)")
        .eq("user_id", userId!);
      const ids = (us ?? []).map((r: { specialty_id: string }) => r.specialty_id);
      const bases = Array.from(
        new Set(
          (us ?? [])
            .map((r: any) => (r.provider_specialties?.date_basis as DateBasis | undefined) ?? "due")
            .filter(Boolean),
        ),
      ) as DateBasis[];
      if (ids.length === 0) return { start: [] as string[], done: [] as string[], bases: [] as DateBasis[] };
      const { data: rules } = await supabase
        .from("specialty_stage_rules")
        .select("status_id, is_start, is_done")
        .in("specialty_id", ids);
      return {
        start: (rules ?? []).filter((r) => r.is_start).map((r) => r.status_id),
        done: (rules ?? []).filter((r) => r.is_done).map((r) => r.status_id),
        bases,
      } as { start: string[]; done: string[]; bases: DateBasis[] };
    },
  });

  return useMemo(() => {
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
      dateBases: data.bases,
    });
  }, [userId, data, own, statusOrder, finalStatusIds]);
}

/**
 * Bases de data (Prazo/Postagem) por demanda, deduzidas das especialidades dos
 * responsáveis marcados nela. Usado na visão geral (sem filtro de membro),
 * onde cada demanda deve respeitar a base de quem trabalha nela.
 */
export function useProjectDateBases() {
  const { data: assignees = [] } = useQuery({
    queryKey: ["project_assignees_bases"],
    queryFn: async () =>
      (await supabase.from("project_assignees").select("project_id, user_id")).data ?? [],
  });

  const { data: userBases } = useQuery({
    queryKey: ["user_specialty_bases"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_specialties")
        .select("user_id, provider_specialties(date_basis)");
      const map = new Map<string, Set<DateBasis>>();
      for (const r of (data ?? []) as any[]) {
        const basis = ((r.provider_specialties?.date_basis as DateBasis | undefined) ?? "due") as DateBasis;
        if (!map.has(r.user_id)) map.set(r.user_id, new Set<DateBasis>());
        map.get(r.user_id)!.add(basis);
      }
      return map;
    },
  });

  return useMemo(() => {
    const byProject = new Map<string, DateBasis[]>();
    if (!userBases) return byProject;
    for (const a of assignees as { project_id: string; user_id: string }[]) {
      const bases = userBases.get(a.user_id);
      if (!bases || bases.size === 0) continue;
      const cur = new Set<DateBasis>(byProject.get(a.project_id) ?? []);
      bases.forEach((b) => cur.add(b));
      byProject.set(a.project_id, Array.from(cur));
    }
    return byProject;
  }, [assignees, userBases]);
}

/** Datas de referência de uma demanda para um conjunto de bases. */
export function refDatesForBases(
  p: { due_date?: string | null; post_date?: string | null },
  bases: DateBasis[],
) {
  const out: string[] = [];
  for (const b of bases) {
    const primary = b === "post" ? p.post_date : p.due_date;
    const fallback = b === "post" ? p.due_date : p.post_date;
    const d = primary ?? fallback;
    if (d) out.push(d);
  }
  return Array.from(new Set(out));
}

