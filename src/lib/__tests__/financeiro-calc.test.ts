import { describe, it, expect } from "vitest";
import {
  computeMonthKpis,
  pendingFixed,
  pendingRecurring,
  monthlyAmount,
  type Entry,
  type FixedCost,
  type RecurringIncome,
} from "@/lib/financeiro-calc";

const start = new Date("2026-05-01T00:00:00");
const end = new Date("2026-05-31T23:59:59");

const fixed: FixedCost[] = [
  { name: "Aluguel", amount: 3000, recurrence: "monthly" },
  { name: "Software anual", amount: 1200, recurrence: "annual" }, // 100/mês
];

const recurring: RecurringIncome[] = [
  { description: "Contrato Cliente A", amount: 5000 },
  { description: "Contrato Cliente B", amount: 2000 },
];

describe("financeiro-calc — regra de confirmação", () => {
  it("monthlyAmount: rateia recorrência anual em 12", () => {
    expect(monthlyAmount({ name: "x", amount: 1200, recurrence: "annual" })).toBe(100);
    expect(monthlyAmount({ name: "x", amount: 300, recurrence: "monthly" })).toBe(300);
  });

  it("sem confirmações: nada entra no realizado, tudo fica pendente", () => {
    const k = computeMonthKpis({ entries: [], fixed, recurring, taxPct: 0.06, start, end });
    expect(k.incomes).toBe(0);
    expect(k.expenses).toBe(0);
    expect(k.fixedConfirmed).toBe(0);
    expect(k.fixedPending).toBe(3100); // 3000 + 100
    expect(k.taxes).toBe(0);
    expect(k.liquido).toBe(0);
    expect(pendingRecurring(recurring, []).length).toBe(2);
    expect(pendingFixed(fixed, []).length).toBe(2);
  });

  it("custo fixo só conta como realizado depois de confirmado (entry no mês)", () => {
    const entries: Entry[] = [
      { kind: "expense", entry_date: "2026-05-05", amount: 3000, description: "Aluguel" },
    ];
    const k = computeMonthKpis({ entries, fixed, recurring, taxPct: 0.06, start, end });
    expect(k.expenses).toBe(3000);
    expect(k.fixedConfirmed).toBe(3000);
    expect(k.fixedPending).toBe(100); // só o software anual continua pendente
    expect(pendingFixed(fixed, entries).map((c) => c.name)).toEqual(["Software anual"]);
  });

  it("receita recorrente só conta como realizado depois de confirmada", () => {
    const entries: Entry[] = [
      { kind: "income", entry_date: "2026-05-10", amount: 5000, description: "Contrato Cliente A" },
    ];
    const k = computeMonthKpis({ entries, fixed, recurring, taxPct: 0.06, start, end });
    expect(k.incomes).toBe(5000);
    expect(k.taxes).toBeCloseTo(300, 5); // 6% sobre confirmado
    expect(k.liquido).toBeCloseTo(5000 - 0 - 300, 5);
    expect(pendingRecurring(recurring, entries).map((r) => r.description)).toEqual([
      "Contrato Cliente B",
    ]);
  });

  it("confirmação fora do mês selecionado NÃO entra no realizado do mês", () => {
    const entries: Entry[] = [
      // mês anterior
      { kind: "expense", entry_date: "2026-04-28", amount: 3000, description: "Aluguel" },
      { kind: "income", entry_date: "2026-04-15", amount: 5000, description: "Contrato Cliente A" },
    ];
    const k = computeMonthKpis({ entries, fixed, recurring, taxPct: 0.06, start, end });
    expect(k.incomes).toBe(0);
    expect(k.expenses).toBe(0);
    expect(k.fixedConfirmed).toBe(0);
    expect(k.fixedPending).toBe(3100);
    expect(k.taxes).toBe(0);
    expect(k.liquido).toBe(0);
  });

  it("matching de descrição é case-insensitive e ignora espaços", () => {
    const entries: Entry[] = [
      { kind: "expense", entry_date: "2026-05-05", amount: 3000, description: "  aluguel  " },
    ];
    expect(pendingFixed(fixed, entries).map((c) => c.name)).toEqual(["Software anual"]);
  });

  it("KPIs com tudo confirmado: liquido = receitas - despesas - impostos (sem depreciação)", () => {
    const entries: Entry[] = [
      { kind: "income", entry_date: "2026-05-02", amount: 5000, description: "Contrato Cliente A" },
      { kind: "income", entry_date: "2026-05-02", amount: 2000, description: "Contrato Cliente B" },
      { kind: "expense", entry_date: "2026-05-05", amount: 3000, description: "Aluguel" },
      { kind: "expense", entry_date: "2026-05-05", amount: 100, description: "Software anual" },
    ];
    const k = computeMonthKpis({ entries, fixed, recurring, taxPct: 0.06, start, end });
    expect(k.incomes).toBe(7000);
    expect(k.expenses).toBe(3100);
    expect(k.fixedConfirmed).toBe(3100);
    expect(k.fixedPending).toBe(0);
    expect(k.taxes).toBeCloseTo(420, 5);
    expect(k.liquido).toBeCloseTo(7000 - 3100 - 420, 5);
  });
});
