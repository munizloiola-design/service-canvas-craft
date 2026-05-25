// Pure helpers for the Financeiro module.
// Regra: custos fixos e receitas recorrentes só entram no "realizado" do mês
// depois de confirmados na aba "Confirmações do mês" (ou seja, depois de
// gerarem uma linha em `financial_entries` para o mês selecionado).
//
// Correspondência entry ↔ origem:
//   1) PRIMÁRIO: source_type + source_id (preenchidos na confirmação).
//   2) FALLBACK (legado): descrição normalizada (trim + lowercase + unaccent)
//      apenas quando o entry NÃO tem source_id. Isso evita que dois itens
//      com o mesmo nome (ou renomeados) sejam confundidos.

export type Kind = "income" | "expense";
export type SourceType = "recurring_income" | "fixed_cost" | "manual";

export interface Entry {
  id?: string;
  kind: Kind;
  entry_date: string; // ISO date
  amount: number | string;
  description?: string | null;
  source_type?: SourceType | string | null;
  source_id?: string | null;
}

export interface FixedCost {
  id: string;
  name: string;
  amount: number | string;
  recurrence?: "monthly" | "annual" | string;
  active?: boolean;
}

export interface RecurringIncome {
  id: string;
  description: string;
  amount: number | string;
  active?: boolean;
}

const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const normDesc = (s?: string | null): string =>
  stripAccents((s ?? "").trim().toLowerCase()).replace(/\s+/g, " ");

export const monthlyAmount = (c: FixedCost): number => {
  const v = Number(c.amount) || 0;
  return c.recurrence === "annual" ? v / 12 : v;
};

export const entriesInMonth = (entries: Entry[], start: Date, end: Date): Entry[] =>
  entries.filter((e) => {
    const d = new Date(e.entry_date);
    return d >= start && d <= end;
  });

/**
 * Find the confirmation entry for a given source within a list of month entries.
 * Primary key: source_type + source_id.
 * Fallback (legacy entries with no source_id): normalized description match,
 * but only against entries that themselves have no source_id (so a confirmed
 * item never "absorbs" the slot of a homonym item).
 */
export const findEntryForSource = (
  source: { id: string; kind: Kind; description: string },
  monthEntries: Entry[],
): Entry | undefined => {
  const sourceType: SourceType =
    source.kind === "income" ? "recurring_income" : "fixed_cost";

  const byId = monthEntries.find(
    (m) =>
      m.kind === source.kind &&
      m.source_type === sourceType &&
      m.source_id === source.id,
  );
  if (byId) return byId;

  const target = normDesc(source.description);
  if (!target) return undefined;
  return monthEntries.find(
    (m) =>
      m.kind === source.kind &&
      !m.source_id && // só faz fallback em linhas sem vínculo estruturado
      normDesc(m.description) === target,
  );
};

export const pendingRecurring = (
  recurring: RecurringIncome[],
  monthEntries: Entry[],
): RecurringIncome[] =>
  recurring.filter(
    (r) =>
      !findEntryForSource(
        { id: r.id, kind: "income", description: r.description },
        monthEntries,
      ),
  );

export const pendingFixed = (
  fixed: FixedCost[],
  monthEntries: Entry[],
): FixedCost[] =>
  fixed.filter(
    (c) =>
      !findEntryForSource(
        { id: c.id, kind: "expense", description: c.name },
        monthEntries,
      ),
  );

export const sumIncomes = (monthEntries: Entry[]): number =>
  monthEntries
    .filter((e) => e.kind === "income")
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

export const sumExpenses = (monthEntries: Entry[]): number =>
  monthEntries
    .filter((e) => e.kind === "expense")
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

export interface MonthKpis {
  incomes: number;
  expenses: number;
  fixedPrevisto: number;
  fixedPending: number;
  fixedConfirmed: number;
  taxes: number;
  liquido: number;
}

export const computeMonthKpis = (params: {
  entries: Entry[];
  fixed: FixedCost[];
  recurring: RecurringIncome[];
  taxPct: number;
  start: Date;
  end: Date;
}): MonthKpis => {
  const monthEntries = entriesInMonth(params.entries, params.start, params.end);
  const incomes = sumIncomes(monthEntries);
  const expenses = sumExpenses(monthEntries);

  const fixedPrevisto = params.fixed.reduce((s, c) => s + monthlyAmount(c), 0);
  const fixedPending = pendingFixed(params.fixed, monthEntries).reduce(
    (s, c) => s + monthlyAmount(c),
    0,
  );
  const fixedConfirmed = Math.max(0, fixedPrevisto - fixedPending);

  const taxes = incomes * params.taxPct;
  const liquido = incomes - expenses - taxes;

  return { incomes, expenses, fixedPrevisto, fixedPending, fixedConfirmed, taxes, liquido };
};

export interface ChartPoint {
  year: number;
  month: number; // 1-12
  Entradas: number;
  Saidas: number;
  Resultado: number;
}

/**
 * Builds the 12-month "Entradas vs Saídas vs Resultado" series used by the
 * Financeiro chart. Considers exclusively confirmed entries (financial_entries) —
 * recurring incomes and fixed costs only appear here AFTER confirmation.
 */
export const buildMonthlyChart = (
  entries: Entry[],
  reference: Date = new Date(),
): ChartPoint[] => {
  return Array.from({ length: 12 }, (_, idx) => {
    const ref = new Date(reference.getFullYear(), reference.getMonth() - (11 - idx), 1);
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    const set = entriesInMonth(entries, start, end);
    const Entradas = sumIncomes(set);
    const Saidas = sumExpenses(set);
    return {
      year: ref.getFullYear(),
      month: ref.getMonth() + 1,
      Entradas,
      Saidas,
      Resultado: Entradas - Saidas,
    };
  });
};

/**
 * Simulates the "Confirmar" action from the Confirmações tab: produces a new
 * financial_entries row with the structured source_type/source_id link that
 * the UI persists.
 */
export const buildConfirmationEntry = (
  source:
    | { kind: "income"; id: string; description: string; amount: number | string }
    | { kind: "expense"; id: string; description: string; amount: number | string },
  monthDate: Date,
): Entry => {
  const sourceType: SourceType =
    source.kind === "income" ? "recurring_income" : "fixed_cost";
  const iso = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}-${String(monthDate.getDate()).padStart(2, "0")}`;
  return {
    id: `entry-${source.kind}-${source.id}-${iso}`,
    kind: source.kind,
    entry_date: iso,
    amount: Number(source.amount) || 0,
    description: source.description,
    source_type: sourceType,
    source_id: source.id,
  };
};

export interface OverdueItem {
  kind: Kind;
  sourceId: string;
  description: string;
  amount: number;
  monthDate: Date; // first day of the overdue month
}

/**
 * Lists every active recurring income / fixed cost that has NO confirmation
 * entry in a past month (within `monthsBack` months prior to `today`). Used by
 * the "Atrasados" column.
 */
export const overdueItems = (params: {
  recurring: RecurringIncome[];
  fixed: FixedCost[];
  entries: Entry[];
  today?: Date;
  monthsBack?: number;
}): OverdueItem[] => {
  const today = params.today ?? new Date();
  const monthsBack = params.monthsBack ?? 12;
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const out: OverdueItem[] = [];

  for (let i = 1; i <= monthsBack; i++) {
    const monthDate = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - i, 1);
    const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthEntries = entriesInMonth(params.entries, start, end);

    for (const r of params.recurring) {
      if (r.active === false) continue;
      const found = findEntryForSource(
        { id: r.id, kind: "income", description: r.description },
        monthEntries,
      );
      if (!found) {
        out.push({
          kind: "income",
          sourceId: r.id,
          description: r.description,
          amount: Number(r.amount) || 0,
          monthDate,
        });
      }
    }
    for (const c of params.fixed) {
      if (c.active === false) continue;
      const found = findEntryForSource(
        { id: c.id, kind: "expense", description: c.name },
        monthEntries,
      );
      if (!found) {
        out.push({
          kind: "expense",
          sourceId: c.id,
          description: c.name,
          amount: monthlyAmount(c),
          monthDate,
        });
      }
    }
  }
  out.sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime());
  return out;
};

