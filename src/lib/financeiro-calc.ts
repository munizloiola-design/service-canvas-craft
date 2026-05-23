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
