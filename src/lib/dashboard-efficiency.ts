/**
 * Taxa de eficiência do Dashboard.
 *
 * Sobre as demandas concluídas do período:
 *   pontualidade = concluídas dentro da data de referência ÷ concluídas
 *   taxa de retorno = demandas que voltaram ÷ concluídas
 *   eficiência = pontualidade − taxa de retorno (mínimo 0)
 */

export type EffProject = {
  id: string;
  status_id?: string | null;
  due_date?: string | null;
  post_date?: string | null;
  client_decision?: string | null;
};

export type EfficiencyInput = {
  isDone: (statusId: string | null | undefined) => boolean;
  refDates: (p: { due_date?: string | null; post_date?: string | null }) => string[];
  /** Ids de demandas que voltaram de fase no histórico. */
  regressedIds: Set<string>;
  /** Data de referência para "no prazo" (yyyy-MM-dd). */
  today: string;
  /** Data de conclusão por demanda (yyyy-MM-dd), quando conhecida. */
  doneDates?: Map<string, string>;
};

export type EfficiencyResult = {
  concluded: number;
  onTime: number;
  late: number;
  returned: number;
  punctuality: number | null;
  returnRate: number | null;
  efficiency: number | null;
  lateIds: Set<string>;
  returnedIds: Set<string>;
};

export function isReturned(p: EffProject, regressedIds: Set<string>) {
  return p.client_decision === "reprovado" || regressedIds.has(p.id);
}

export type LatenessResult = {
  /** Atrasou alguma vez (aberta vencida ou concluída após a data de referência). */
  lateIds: Set<string>;
  /** Atrasadas que ainda não foram concluídas. */
  openLateIds: Set<string>;
  /** Atrasadas que já foram entregues (só entram no cálculo de eficiência). */
  resolvedLateIds: Set<string>;
  /** Data de referência efetiva por demanda (yyyy-MM-dd). */
  deadlines: Map<string, string>;
};

/**
 * Atraso segundo as regras do perfil: data de referência (prazo ou postagem)
 * e definição de "concluído" da especialidade.
 */
export function computeLateness(
  projects: EffProject[],
  opts: Pick<EfficiencyInput, "isDone" | "refDates" | "today" | "doneDates">,
): LatenessResult {
  const { isDone, refDates, today, doneDates } = opts;
  const lateIds = new Set<string>();
  const openLateIds = new Set<string>();
  const resolvedLateIds = new Set<string>();
  const deadlines = new Map<string, string>();

  for (const p of projects) {
    const dates = refDates(p);
    if (!dates.length) continue;
    const deadline = [...dates].sort()[0];
    deadlines.set(p.id, deadline);
    const done = isDone(p.status_id);
    const finished = done ? (doneDates?.get(p.id) ?? today) : today;
    if (finished > deadline) {
      lateIds.add(p.id);
      if (done) resolvedLateIds.add(p.id);
      else openLateIds.add(p.id);
    }
  }

  return { lateIds, openLateIds, resolvedLateIds, deadlines };
}

export function computeEfficiency(projects: EffProject[], opts: EfficiencyInput): EfficiencyResult {
  const { isDone, regressedIds } = opts;
  const concludedList = projects.filter((p) => isDone(p.status_id));
  const { lateIds: allLate } = computeLateness(projects, opts);

  const lateIds = new Set<string>();
  const returnedIds = new Set<string>();

  for (const p of concludedList) {
    if (allLate.has(p.id)) lateIds.add(p.id);
    if (isReturned(p, regressedIds)) returnedIds.add(p.id);
  }


  const concluded = concludedList.length;
  if (concluded === 0) {
    return {
      concluded: 0,
      onTime: 0,
      late: 0,
      returned: 0,
      punctuality: null,
      returnRate: null,
      efficiency: null,
      lateIds,
      returnedIds,
    };
  }

  const late = lateIds.size;
  const onTime = concluded - late;
  const returned = returnedIds.size;
  const punctuality = onTime / concluded;
  const returnRate = returned / concluded;
  const efficiency = Math.max(0, punctuality - returnRate);

  return { concluded, onTime, late, returned, punctuality, returnRate, efficiency, lateIds, returnedIds };
}

export const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
