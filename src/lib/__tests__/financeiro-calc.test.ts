import { describe, it, expect } from "vitest";
import {
  computeMonthKpis,
  pendingFixed,
  pendingRecurring,
  findEntryForSource,
  monthlyAmount,
  normDesc,
  type Entry,
  type FixedCost,
  type RecurringIncome,
} from "@/lib/financeiro-calc";

const start = new Date("2026-05-01T00:00:00");
const end = new Date("2026-05-31T23:59:59");

const fixed: FixedCost[] = [
  { id: "fx-1", name: "Aluguel", amount: 3000, recurrence: "monthly" },
  { id: "fx-2", name: "Software anual", amount: 1200, recurrence: "annual" }, // 100/mês
];

const recurring: RecurringIncome[] = [
  { id: "rc-1", description: "Contrato Cliente A", amount: 5000 },
  { id: "rc-2", description: "Contrato Cliente B", amount: 2000 },
];

describe("financeiro-calc — regra de confirmação", () => {
  it("monthlyAmount: rateia recorrência anual em 12", () => {
    expect(monthlyAmount({ id: "x", name: "x", amount: 1200, recurrence: "annual" })).toBe(100);
    expect(monthlyAmount({ id: "x", name: "x", amount: 300, recurrence: "monthly" })).toBe(300);
  });

  it("sem confirmações: nada entra no realizado, tudo fica pendente", () => {
    const k = computeMonthKpis({ entries: [], fixed, recurring, taxPct: 0.06, start, end });
    expect(k.incomes).toBe(0);
    expect(k.fixedConfirmed).toBe(0);
    expect(k.fixedPending).toBe(3100);
    expect(k.liquido).toBe(0);
    expect(pendingRecurring(recurring, []).length).toBe(2);
    expect(pendingFixed(fixed, []).length).toBe(2);
  });

  it("confirmação por source_id (estruturada) é a chave primária", () => {
    const entries: Entry[] = [
      {
        kind: "expense",
        entry_date: "2026-05-05",
        amount: 3000,
        description: "qualquer outro texto",
        source_type: "fixed_cost",
        source_id: "fx-1",
      },
    ];
    const k = computeMonthKpis({ entries, fixed, recurring, taxPct: 0.06, start, end });
    expect(k.fixedConfirmed).toBe(3000);
    expect(pendingFixed(fixed, entries).map((c) => c.id)).toEqual(["fx-2"]);
  });

  it("fallback por descrição: aceita match em entry legada (sem source_id)", () => {
    const entries: Entry[] = [
      { kind: "expense", entry_date: "2026-05-05", amount: 3000, description: "Aluguel" },
    ];
    expect(pendingFixed(fixed, entries).map((c) => c.id)).toEqual(["fx-2"]);
  });

  it("homônimos: dois custos fixos com mesmo nome não colidem quando há source_id", () => {
    const twins: FixedCost[] = [
      { id: "a", name: "Internet", amount: 200, recurrence: "monthly" },
      { id: "b", name: "Internet", amount: 350, recurrence: "monthly" },
    ];
    const entries: Entry[] = [
      {
        kind: "expense",
        entry_date: "2026-05-04",
        amount: 200,
        description: "Internet",
        source_type: "fixed_cost",
        source_id: "a",
      },
    ];
    expect(pendingFixed(twins, entries).map((c) => c.id)).toEqual(["b"]);
  });

  it("renomear o custo após confirmar NÃO desfaz a confirmação (match por id)", () => {
    const renamed: FixedCost[] = [
      { id: "fx-1", name: "Aluguel sala nova", amount: 3000, recurrence: "monthly" },
    ];
    const entries: Entry[] = [
      {
        kind: "expense",
        entry_date: "2026-05-05",
        amount: 3000,
        description: "Aluguel",
        source_type: "fixed_cost",
        source_id: "fx-1",
      },
    ];
    expect(pendingFixed(renamed, entries)).toEqual([]);
  });

  it("entry de outra origem com mesma descrição NÃO conta como confirmação", () => {
    // Lançamento manual com descrição "Aluguel" mas vínculo a outra origem
    // (source_id diferente) — não pode confundir a regra.
    const entries: Entry[] = [
      {
        kind: "expense",
        entry_date: "2026-05-05",
        amount: 3000,
        description: "Aluguel",
        source_type: "fixed_cost",
        source_id: "outro-id-qualquer",
      },
    ];
    expect(findEntryForSource(
      { id: "fx-1", kind: "expense", description: "Aluguel" },
      entries,
    )).toBeUndefined();
    expect(pendingFixed(fixed, entries).map((c) => c.id)).toEqual(["fx-1", "fx-2"]);
  });

  it("normDesc: case-insensitive, sem acento, espaços colapsados", () => {
    expect(normDesc("  Água   Mineral  ")).toBe(normDesc("agua mineral"));
    expect(normDesc("Serviço")).toBe(normDesc("servico"));
  });

  it("receita recorrente: confirmação por source_id", () => {
    const entries: Entry[] = [
      {
        kind: "income",
        entry_date: "2026-05-10",
        amount: 5000,
        description: "pagto via pix",
        source_type: "recurring_income",
        source_id: "rc-1",
      },
    ];
    const k = computeMonthKpis({ entries, fixed, recurring, taxPct: 0.06, start, end });
    expect(k.incomes).toBe(5000);
    expect(k.taxes).toBeCloseTo(300, 5);
    expect(pendingRecurring(recurring, entries).map((r) => r.id)).toEqual(["rc-2"]);
  });

  it("confirmação fora do mês NÃO conta como realizado", () => {
    const entries: Entry[] = [
      {
        kind: "expense",
        entry_date: "2026-04-28",
        amount: 3000,
        description: "Aluguel",
        source_type: "fixed_cost",
        source_id: "fx-1",
      },
    ];
    const k = computeMonthKpis({ entries, fixed, recurring, taxPct: 0.06, start, end });
    expect(k.expenses).toBe(0);
    expect(k.fixedPending).toBe(3100);
  });
});
