// Pure helpers for the Financeiro module.
// These functions encode the business rule:
// Custos fixos e receitas recorrentes só entram no "realizado" do mês
// depois de confirmados na aba "Confirmações do mês" (ou seja, depois
// de gerarem uma linha em `financial_entries` para o mês selecionado).

export type Kind = "income" | "expense";

export interface Entry {
  kind: Kind;
  entry_date: string; // ISO date
  amount: number | string;
  description?: string | null;
}

export interface FixedCost {
  name: string;
  amount: number | string;
  recurrence?: "monthly" | "annual" | string;
  active?: boolean;
}

export interface RecurringIncome {
  description: string;
  amount: number | string;
  active?: boolean;
}

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

export const monthlyAmount = (c: FixedCost): number => {
  const v = Number(c.amount) || 0;
  return c.recurrence === "annual" ? v / 12 : v;
};

/** Entries (real, confirmed) within [start, end]. */
export const entriesInMonth = (entries: Entry[], start: Date, end: Date): Entry[] =>
  entries.filter((e) => {
    const d = new Date(e.entry_date);
    return d >= start && d <= end;
  });

/** Recurring incomes still pending confirmation for the given month entries. */
export const pendingRecurring = (
  recurring: RecurringIncome[],
  monthEntries: Entry[],
): RecurringIncome[] =>
  recurring.filter(
    (r) =>
      !monthEntries.some(
        (m) => m.kind === "income" && norm(m.description) === norm(r.description),
      ),
  );

/** Fixed costs still pending confirmation for the given month entries. */
export const pendingFixed = (fixed: FixedCost[], monthEntries: Entry[]): FixedCost[] =>
  fixed.filter(
    (c) =>
      !monthEntries.some(
        (m) => m.kind === "expense" && norm(m.description) === norm(c.name),
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
  incomes: number; // realized income (from financial_entries)
  expenses: number; // realized expenses (from financial_entries)
  fixedPrevisto: number; // sum of all fixed costs for the month
  fixedPending: number; // fixed costs not yet confirmed
  fixedConfirmed: number; // fixed costs confirmed (previsto - pending)
  taxes: number; // tax_pct over confirmed incomes only
  liquido: number; // incomes - expenses - taxes (only confirmed values)
}

export const computeMonthKpis = (params: {
  entries: Entry[];
  fixed: FixedCost[];
  recurring: RecurringIncome[];
  taxPct: number; // 0..1
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
