import { describe, it, expect } from "vitest";
import {
  buildConfirmationEntry,
  buildMonthlyChart,
  computeMonthKpis,
  overdueItems,
  pendingFixed,
  pendingRecurring,
  type Entry,
  type FixedCost,
  type RecurringIncome,
} from "../financeiro-calc";


/**
 * Testes de integração do fluxo "Confirmações do mês":
 *   estado inicial → marcar Confirmar → verificar KPIs + série do gráfico.
 *
 * Usa exatamente os mesmos helpers consumidos por src/routes/_app/financeiro.tsx,
 * portanto cobre o novo critério source_type/source_id de ponta a ponta.
 */

const REF = new Date(2026, 4, 15); // 15/mai/2026
const START = new Date(2026, 4, 1, 0, 0, 0, 0);
const END = new Date(2026, 4, 31, 23, 59, 59, 999);

const recurring: RecurringIncome[] = [
  { id: "ri-1", description: "Mensalidade Cliente A", amount: 3000, active: true },
  { id: "ri-2", description: "Mensalidade Cliente B", amount: 1500, active: true },
];

const fixed: FixedCost[] = [
  { id: "fc-1", name: "Aluguel", amount: 2000, recurrence: "monthly", active: true },
  { id: "fc-2", name: "Internet", amount: 200, recurrence: "monthly", active: true },
  { id: "fc-3", name: "Contador (anual)", amount: 1200, recurrence: "annual", active: true },
];

const TAX = 0.06;

const run = (entries: Entry[]) =>
  computeMonthKpis({ entries, fixed, recurring, taxPct: TAX, start: START, end: END });

describe("Fluxo completo de confirmação (UI ↔ KPIs ↔ gráfico)", () => {
  it("estado inicial: nada confirmado → KPIs zerados e pendências completas", () => {
    const k = run([]);
    expect(k.incomes).toBe(0);
    expect(k.expenses).toBe(0);
    expect(k.taxes).toBe(0);
    expect(k.liquido).toBe(0);
    expect(k.fixedConfirmed).toBe(0);
    // 2000 + 200 + 1200/12 = 2300
    expect(k.fixedPending).toBeCloseTo(2300, 5);
    expect(pendingRecurring(recurring, []).map((r) => r.id)).toEqual(["ri-1", "ri-2"]);
    expect(pendingFixed(fixed, []).map((c) => c.id)).toEqual(["fc-1", "fc-2", "fc-3"]);

    const chart = buildMonthlyChart([], REF);
    expect(chart).toHaveLength(12);
    const last = chart[11];
    expect(last.year).toBe(2026);
    expect(last.month).toBe(5);
    expect(last.Entradas).toBe(0);
    expect(last.Saidas).toBe(0);
    expect(last.Resultado).toBe(0);
  });

  it("confirmar uma receita recorrente: KPI sobe, pendência some, gráfico reflete", () => {
    const entries: Entry[] = [];
    entries.push(buildConfirmationEntry({ kind: "income", ...recurring[0] }, REF));

    const k = run(entries);
    expect(k.incomes).toBe(3000);
    expect(k.taxes).toBeCloseTo(180, 5);
    expect(k.liquido).toBeCloseTo(3000 - 180, 5);
    expect(pendingRecurring(recurring, entries).map((r) => r.id)).toEqual(["ri-2"]);

    const last = buildMonthlyChart(entries, REF)[11];
    expect(last.Entradas).toBe(3000);
    expect(last.Saidas).toBe(0);
    expect(last.Resultado).toBe(3000);
  });

  it("confirmar custo fixo mensal: fixedConfirmed sobe e fixedPending cai", () => {
    const entries: Entry[] = [
      buildConfirmationEntry({ kind: "expense", id: fixed[0].id, description: fixed[0].name, amount: fixed[0].amount }, REF),
    ];
    const k = run(entries);
    expect(k.expenses).toBe(2000);
    expect(k.fixedConfirmed).toBeCloseTo(2000, 5);
    expect(k.fixedPending).toBeCloseTo(300, 5); // 200 + 100 (anual/12)
    expect(pendingFixed(fixed, entries).map((c) => c.id)).toEqual(["fc-2", "fc-3"]);

    const last = buildMonthlyChart(entries, REF)[11];
    expect(last.Saidas).toBe(2000);
    expect(last.Resultado).toBe(-2000);
  });

  it("fluxo completo: confirma todas as receitas e custos → KPIs e gráfico finais batem", () => {
    const entries: Entry[] = [
      ...recurring.map((r) => buildConfirmationEntry({ kind: "income", ...r }, REF)),
      ...fixed.map((c) =>
        buildConfirmationEntry(
          { kind: "expense", id: c.id, description: c.name, amount: c.recurrence === "annual" ? Number(c.amount) / 12 : Number(c.amount) },
          REF,
        ),
      ),
    ];
    const k = run(entries);
    expect(k.incomes).toBe(4500);
    expect(k.expenses).toBeCloseTo(2300, 5);
    expect(k.fixedPending).toBe(0);
    expect(k.fixedConfirmed).toBeCloseTo(2300, 5);
    expect(k.taxes).toBeCloseTo(270, 5);
    expect(k.liquido).toBeCloseTo(4500 - 2300 - 270, 5);
    expect(pendingRecurring(recurring, entries)).toEqual([]);
    expect(pendingFixed(fixed, entries)).toEqual([]);

    const last = buildMonthlyChart(entries, REF)[11];
    expect(last.Entradas).toBe(4500);
    expect(last.Saidas).toBeCloseTo(2300, 5);
    expect(last.Resultado).toBeCloseTo(2200, 5);
  });

  it("homônimos: descrição igual NÃO confunde quando vínculo source_id existe", () => {
    const recurringTwins: RecurringIncome[] = [
      { id: "ri-x", description: "Consultoria", amount: 1000 },
      { id: "ri-y", description: "Consultoria", amount: 2500 },
    ];
    // Confirma apenas o segundo via source_id
    const entries: Entry[] = [
      buildConfirmationEntry({ kind: "income", ...recurringTwins[1] }, REF),
    ];
    // Só o "ri-x" deve continuar pendente — apesar das descrições idênticas
    expect(pendingRecurring(recurringTwins, entries).map((r) => r.id)).toEqual(["ri-x"]);

    const k = computeMonthKpis({
      entries,
      fixed: [],
      recurring: recurringTwins,
      taxPct: TAX,
      start: START,
      end: END,
    });
    expect(k.incomes).toBe(2500);
  });

  it("entry legado sem source_id continua casando por descrição (fallback)", () => {
    const entries: Entry[] = [
      {
        kind: "income",
        entry_date: "2026-05-10",
        amount: 3000,
        description: "Mensalidade Cliente A",
        // sem source_type/source_id — entry antigo
      },
    ];
    expect(pendingRecurring(recurring, entries).map((r) => r.id)).toEqual(["ri-2"]);
  });

  it("entry de outro mês NÃO conta para o mês corrente nem zera pendências", () => {
    const otherMonth = new Date(2026, 3, 10); // abr/26
    const entries: Entry[] = [
      buildConfirmationEntry({ kind: "income", ...recurring[0] }, otherMonth),
    ];
    const k = run(entries);
    expect(k.incomes).toBe(0);
    expect(pendingRecurring(recurring, []).map((r) => r.id)).toEqual(["ri-1", "ri-2"]);

    const chart = buildMonthlyChart(entries, REF);
    expect(chart[10].Entradas).toBe(3000); // abril (penúltimo bucket)
    expect(chart[11].Entradas).toBe(0); // maio
  });
});

describe("Coluna Atrasados (overdueItems)", () => {
  const TODAY = new Date(2026, 4, 15); // 15/mai/2026

  it("lista recorrentes e fixos sem confirmação nos meses anteriores", () => {
    // Confirma só abr/26 para ri-1 e fc-1 — todo o resto fica em atraso
    const entries: Entry[] = [
      buildConfirmationEntry({ kind: "income", ...recurring[0] }, new Date(2026, 3, 10)),
      buildConfirmationEntry({ kind: "expense", id: fixed[0].id, description: fixed[0].name, amount: fixed[0].amount }, new Date(2026, 3, 5)),
    ];
    const out = overdueItems({ recurring, fixed, entries, today: TODAY, monthsBack: 2 });
    // 2 meses atrás (mar/26 e abr/26): em abr/26 ri-1 e fc-1 confirmados;
    // ri-2, fc-2, fc-3 atrasados nos 2 meses; ri-1 e fc-1 atrasados só em mar/26.
    // Total: ri-2 (2x) + fc-2 (2x) + fc-3 (2x) + ri-1 (1x) + fc-1 (1x) = 8
    expect(out).toHaveLength(8);
    // Ordenado: mais antigo primeiro (mar/26)
    expect(out[0].monthDate.getMonth()).toBe(2); // março
  });

  it("não considera item inativo nem mês atual/futuro", () => {
    const recurringWithInactive: RecurringIncome[] = [
      ...recurring,
      { id: "ri-off", description: "Antigo", amount: 999, active: false },
    ];
    const out = overdueItems({
      recurring: recurringWithInactive,
      fixed: [],
      entries: [],
      today: TODAY,
      monthsBack: 3,
    });
    // ri-off não aparece; mês atual (mai/26) e futuros não contam
    expect(out.every((o) => o.sourceId !== "ri-off")).toBe(true);
    expect(out.every((o) => o.monthDate < new Date(2026, 4, 1))).toBe(true);
  });

  it("respeita createdAt: item recém-cadastrado não aparece em atrasos passados", () => {
    const recurringNovo: RecurringIncome[] = [
      { id: "ri-novo", description: "Cliente novo", amount: 1000, active: true, createdAt: "2026-05-01" },
    ];
    const fixedNovo: FixedCost[] = [
      { id: "fc-novo", name: "Software novo", amount: 100, recurrence: "monthly", active: true, createdAt: "2026-05-01" },
    ];
    const out = overdueItems({
      recurring: recurringNovo,
      fixed: fixedNovo,
      entries: [],
      today: TODAY,
      monthsBack: 6,
    });
    // Nada deve aparecer — só foi criado no mês corrente
    expect(out).toHaveLength(0);
  });

  it("createdAt no meio do período: lista só meses ≥ createdAt", () => {
    const recurringMix: RecurringIncome[] = [
      { id: "ri-mar", description: "Cliente desde mar", amount: 500, active: true, createdAt: "2026-03-15" },
    ];
    const out = overdueItems({
      recurring: recurringMix,
      fixed: [],
      entries: [],
      today: TODAY,
      monthsBack: 6,
    });
    // Hoje = 15/mai/2026. monthsBack=6 → nov/25..abr/26. createdAt mar/26.
    // Atrasos válidos: mar/26 e abr/26 (mai/26 é mês corrente, não conta).
    expect(out).toHaveLength(2);
    expect(out.every((o) => o.monthDate >= new Date(2026, 2, 1))).toBe(true);
  });

  it("confirmar um atraso remove-o da lista (via buildConfirmationEntry)", () => {
    const before = overdueItems({ recurring, fixed: [], entries: [], today: TODAY, monthsBack: 1 });
    expect(before.length).toBeGreaterThan(0);
    const targetMonth = before[0].monthDate;
    const entries: Entry[] = [
      buildConfirmationEntry({ kind: "income", ...recurring[0] }, targetMonth),
      buildConfirmationEntry({ kind: "income", ...recurring[1] }, targetMonth),
    ];
    const after = overdueItems({ recurring, fixed: [], entries, today: TODAY, monthsBack: 1 });
    expect(after).toHaveLength(0);
  });
});

