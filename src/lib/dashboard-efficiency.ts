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

export function computeEfficiency(projects: EffProject[], opts: EfficiencyInput): EfficiencyResult {
  const { isDone, refDates, regressedIds, today, doneDates } = opts;
  const concludedList = projects.filter((p) => isDone(p.status_id));

  const lateIds = new Set<string>();
  const returnedIds = new Set<string>();

  for (const p of concludedList) {
    const dates = refDates(p);
    if (dates.length) {
      const deadline = dates.sort()[0];
      const finished = doneDates?.get(p.id) ?? today;
      if (finished > deadline) lateIds.add(p.id);
    }
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
