import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSectionGate } from "@/lib/access-sections";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, TrendingUp, TrendingDown, Receipt, CheckCircle2, Pencil, FileDown, Printer, Link2, Copy, ExternalLink, Download, XCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { startOfMonth, endOfMonth, subMonths, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { findEntryForSource } from "@/lib/financeiro-calc";

export const Route = createFileRoute("/_app/financeiro")({ component: FinanceiroPage });

const fmtBRL = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type FinCat = { id: string; name: string; kind: "expense" | "income"; is_fixed: boolean };

function useFinancialCategories(kind?: "expense" | "income") {
  return useQuery({
    queryKey: ["financial_categories", kind ?? "all"],
    queryFn: async () => {
      let q = supabase.from("financial_categories").select("id, name, kind, is_fixed").order("name");
      if (kind) q = q.eq("kind", kind);
      const { data } = await q;
      return (data ?? []) as FinCat[];
    },
  });
}

function FinanceiroPage() {
  const { can, first } = useSectionGate("/financeiro");
  const order = ["dashboard", "custos", "recorrentes", "autorizacoes", "lancamentos", "solicitacoes", "relatorio", "config"];
  const labels: Record<string, string> = {
    dashboard: "Dashboard", custos: "Custos fixos", recorrentes: "Receitas recorrentes",
    autorizacoes: "Autorizações", lancamentos: "Lançamentos", solicitacoes: "Solicitações",
    relatorio: "Relatório", config: "Configurações",
  };
  const panes: Record<string, React.ReactNode> = {
    dashboard: <Dashboard />, custos: <FixedCosts />, recorrentes: <RecurringIncomes />,
    autorizacoes: <Autorizacoes />, lancamentos: <Entries />, solicitacoes: <Solicitacoes />,
    relatorio: <Relatorio />, config: <SettingsTab />,
  };
  const allowed = order.filter(can);
  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gradient">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Dashboard, cadastros, autorizações, lançamentos e relatório.</p>
      </div>
      <Tabs defaultValue={first(order)}>
        <TabsList className="flex-wrap h-auto">
          {allowed.map((k) => <TabsTrigger key={k} value={k}>{labels[k]}</TabsTrigger>)}
        </TabsList>
        {allowed.map((k) => <TabsContent key={k} value={k} className="mt-6">{panes[k]}</TabsContent>)}
      </Tabs>

    </div>
  );
}

// ============================ DASHBOARD ============================

function Dashboard() {
  const { data: entries = [] } = useQuery({
    queryKey: ["financial_entries"],
    queryFn: async () => (await supabase.from("financial_entries").select("*")).data ?? [],
  });
  const { data: fixed = [] } = useQuery({
    queryKey: ["fixed_costs"],
    queryFn: async () => (await supabase.from("fixed_costs").select("*").eq("active", true)).data ?? [],
  });
  const { data: recurring = [] } = useQuery({
    queryKey: ["recurring_incomes"],
    queryFn: async () => (await supabase.from("recurring_incomes").select("*").eq("active", true)).data ?? [],
  });
  const { data: settings } = useQuery({
    queryKey: ["financial_settings"],
    queryFn: async () => (await supabase.from("financial_settings").select("*").eq("id", true).maybeSingle()).data,
  });

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const monthEntries = entries.filter((e: any) => {
    const d = parseISO(e.entry_date);
    return d >= monthStart && d <= monthEnd;
  });
  const incomes = monthEntries.filter((e: any) => e.kind === "income").reduce((s: number, e: any) => s + Number(e.amount), 0);
  const expenses = monthEntries.filter((e: any) => e.kind === "expense").reduce((s: number, e: any) => s + Number(e.amount), 0);
  const taxPct = Number(settings?.tax_pct ?? 0) / 100;
  const taxes = incomes * taxPct;
  const resultado = incomes - expenses - taxes;

  // Previsões = realizado + pendente (recorrências + custos fixos não confirmados)
  const recurringPending = recurring.filter((r: any) =>
    !findEntryForSource({ id: r.id, kind: "income", description: r.description }, monthEntries as any),
  );
  const aReceber = recurringPending.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const fixedPending = fixed.filter((c: any) =>
    !findEntryForSource({ id: c.id, kind: "expense", description: c.name }, monthEntries as any),
  );
  const aPagar = fixedPending.reduce(
    (s: number, c: any) => s + (c.recurrence === "annual" ? Number(c.amount) / 12 : Number(c.amount)),
    0,
  );
  const receitasPrev = incomes + aReceber;
  const despesasPrev = expenses + aPagar + receitasPrev * taxPct;
  const saldoPrev = receitasPrev - despesasPrev;

  // Gráfico 12 meses (apenas lançamentos reais)
  const chart = Array.from({ length: 12 }, (_, idx) => {
    const ref = subMonths(new Date(), 11 - idx);
    const s = startOfMonth(ref), e = endOfMonth(ref);
    const set = entries.filter((x: any) => { const d = parseISO(x.entry_date); return d >= s && d <= e; });
    const ent = set.filter((x: any) => x.kind === "income").reduce((a: number, b: any) => a + Number(b.amount), 0);
    const sai = set.filter((x: any) => x.kind === "expense").reduce((a: number, b: any) => a + Number(b.amount), 0);
    return {
      mes: format(ref, "MMM/yy", { locale: ptBR }),
      Entradas: ent,
      Saidas: sai,
      Resultado: ent - sai,
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Stat label="Entradas (mês)" value={fmtBRL(incomes)} icon={<TrendingUp className="h-4 w-4 text-green-600" />} />
        <Stat label="Saídas (mês)" value={fmtBRL(expenses)} icon={<TrendingDown className="h-4 w-4 text-red-600" />} />
        <Stat label={`Impostos (${settings?.tax_pct ?? 0}%)`} value={fmtBRL(taxes)} icon={<Receipt className="h-4 w-4" />} />
        <Stat label="Resultado realizado" value={fmtBRL(resultado)} highlight={resultado >= 0 ? "pos" : "neg"} />
        <Stat label="Saldo previsto" value={fmtBRL(saldoPrev)} highlight={saldoPrev >= 0 ? "pos" : "neg"} />
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Fonte: lançamentos do mês. Resultado = Entradas − Saídas − Impostos.
      </p>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Previsão do mês</h3>
          <span className="text-xs text-muted-foreground">{format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Receitas</p>
            <p className="text-xl font-semibold text-green-600">{fmtBRL(receitasPrev)} <span className="text-xs text-muted-foreground font-normal">previstas</span></p>
            <div className="text-sm text-muted-foreground flex justify-between"><span>Realizado</span><span className="font-medium text-foreground">{fmtBRL(incomes)}</span></div>
            <div className="text-sm text-muted-foreground flex justify-between"><span>A receber (autorizações pendentes)</span><span className="font-medium text-foreground">{fmtBRL(aReceber)}</span></div>
          </div>
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Despesas</p>
            <p className="text-xl font-semibold text-red-600">{fmtBRL(despesasPrev)} <span className="text-xs text-muted-foreground font-normal">previstas</span></p>
            <div className="text-sm text-muted-foreground flex justify-between"><span>Realizado (saídas)</span><span className="font-medium text-foreground">{fmtBRL(expenses)}</span></div>
            <div className="text-sm text-muted-foreground flex justify-between"><span>A pagar (autorizações pendentes)</span><span className="font-medium text-foreground">{fmtBRL(aPagar)}</span></div>
            <div className="text-sm text-muted-foreground flex justify-between"><span>Impostos sobre receita prevista</span><span className="font-medium text-foreground">{fmtBRL(receitasPrev * taxPct)}</span></div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-medium mb-4">Últimos 12 meses</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
              <Legend />
              <Bar dataKey="Entradas" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="Saidas" fill="var(--chart-3)" radius={[8, 8, 0, 0]} />
              <Line type="monotone" dataKey="Resultado" stroke="var(--chart-4)" strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: "pos" | "neg" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        {icon}
      </div>
      <p className={`text-xl font-semibold mt-1 ${highlight === "pos" ? "text-green-600" : highlight === "neg" ? "text-red-600" : ""}`}>{value}</p>
    </Card>
  );
}

// ============================ LANÇAMENTOS ============================

function Entries() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("gerente");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["financial_entries"],
    queryFn: async () => (await supabase.from("financial_entries").select("*, projects(title), clients(name)").order("entry_date", { ascending: false })).data ?? [],
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-mini"],
    queryFn: async () => (await supabase.from("projects").select("id, title").order("title")).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-mini"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (form: any) => {
      if (editing) {
        const { error } = await supabase.from("financial_entries").update({
          kind: form.kind, entry_date: form.entry_date, description: form.description,
          category: form.category, amount: form.amount, project_id: form.project_id, client_id: form.client_id,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("financial_entries").insert({ ...form, created_by: u.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_entries"] });
      setOpen(false); setEditing(null);
      toast.success("Salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("financial_entries").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financial_entries"] }); toast.success("Removido"); },
  });

  const labelOrigem = (st?: string | null) => {
    if (st === "recurring_income") return "Recorrente";
    if (st === "fixed_cost") return "Custo fixo";
    return "Manual";
  };

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (i: any) => { setEditing(i); setOpen(true); };

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
        <h3 className="font-medium">Lançamentos (entradas e saídas)</h3>
        <div className="flex items-center gap-2">
          <ShareLancamentoLink />
          {canEdit && (
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo lançamento</Button>
          )}
        </div>
      </div>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <EntryForm
          key={editing?.id ?? "new"}
          initial={editing}
          projects={projects}
          clients={clients}
          onSubmit={(f) => save.mutate(f)}
        />
      </Dialog>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Projeto / Cliente</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((i: any) => (
            <TableRow key={i.id}>
              <TableCell>{format(parseISO(i.entry_date), "dd/MM/yyyy")}</TableCell>
              <TableCell><Badge variant={i.kind === "income" ? "default" : "secondary"}>{i.kind === "income" ? "Entrada" : "Saída"}</Badge></TableCell>
              <TableCell className="font-medium">{i.description}</TableCell>
              <TableCell className="text-muted-foreground">{i.category ?? "—"}</TableCell>
              <TableCell><Badge variant="outline" className="text-[10px]">{labelOrigem(i.source_type)}</Badge></TableCell>
              <TableCell className="text-muted-foreground text-sm">{i.projects?.title ?? i.clients?.name ?? "—"}</TableCell>
              <TableCell className={`text-right font-medium ${i.kind === "income" ? "text-green-600" : "text-red-600"}`}>{fmtBRL(Number(i.amount))}</TableCell>
              <TableCell className="text-right">
                {canEdit && (
                  <>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(i)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover este lançamento?")) del.mutate(i.id); }} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum lançamento</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}

function EntryForm({ initial, projects, clients, onSubmit }: { initial?: any; projects: any[]; clients: any[]; onSubmit: (f: any) => void }) {
  const [f, setF] = useState<any>(() => initial ? {
    kind: initial.kind,
    entry_date: initial.entry_date,
    description: initial.description ?? "",
    category: initial.category ?? "",
    amount: Number(initial.amount),
    project_id: initial.project_id ?? null,
    client_id: initial.client_id ?? null,
  } : {
    kind: "income", entry_date: new Date().toISOString().slice(0, 10),
    description: "", category: "", amount: 0, project_id: null, client_id: null,
  });
  const { data: categories = [] } = useFinancialCategories(f.kind as "income" | "expense");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Editar lançamento" : "Novo lançamento"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Entrada</SelectItem>
                <SelectItem value="expense">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Data</Label><Input type="date" value={f.entry_date} onChange={(e) => setF({ ...f, entry_date: e.target.value })} /></div>
        </div>
        <div><Label>Descrição</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Categoria</Label>
            <Select value={f.category || "__none__"} onValueChange={(v) => setF({ ...f, category: v === "__none__" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— sem categoria —</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}{c.is_fixed ? " (fixo)" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">Gerencie categorias em Configurações.</p>
          </div>
          <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></div>
        </div>
        {f.kind === "income" && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={(f.category ?? "").toLowerCase() === "comissão"}
              onCheckedChange={(v) => setF({ ...f, category: v ? "Comissão" : "" })}
            />
            Esta receita é uma comissão
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Projeto</Label>
            <Select value={f.project_id ?? "none"} onValueChange={(v) => setF({ ...f, project_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">—</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cliente</Label>
            <Select value={f.client_id ?? "none"} onValueChange={(v) => setF({ ...f, client_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">—</SelectItem>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)}>Salvar</Button></DialogFooter>
    </DialogContent>
  );
}

// ============================ CUSTOS FIXOS ============================

function FixedCosts() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("gerente");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const { data: items = [] } = useQuery({ queryKey: ["fixed_costs"], queryFn: async () => (await supabase.from("fixed_costs").select("*").order("name")).data ?? [] });
  const { data: expenseCats = [] } = useFinancialCategories("expense");
  const empty = { name: "", category: "", amount: 0, commission_pct: 0, recurrence: "monthly", due_day: 5, active: true };
  const [f, setF] = useState<any>(empty);

  const save = useMutation({
    mutationFn: async (form: any) => {
      if (editing) {
        const { error } = await supabase.from("fixed_costs").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fixed_costs").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fixed_costs"] }); setOpen(false); setEditing(null); setF(empty); toast.success("Salvo"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("fixed_costs").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixed_costs"] }),
  });

  const openNew = () => { setEditing(null); setF(empty); setOpen(true); };
  const openEdit = (i: any) => {
    setEditing(i);
    setF({ name: i.name, category: i.category ?? "", amount: Number(i.amount), commission_pct: Number(i.commission_pct ?? 0), recurrence: i.recurrence ?? "monthly", due_day: i.due_day ?? 5, active: i.active });
    setOpen(true);
  };

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Custos fixos</h3>
        {canEdit && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo</Button>}
      </div>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setF(empty); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar custo fixo" : "Novo custo fixo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={f.category || "__none__"} onValueChange={(v) => setF({ ...f, category: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— sem categoria —</SelectItem>
                    {expenseCats.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}{c.is_fixed ? " (fixo)" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Recorrência</Label>
                <Select value={f.recurrence} onValueChange={(v) => setF({ ...f, recurrence: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="monthly">Mensal</SelectItem><SelectItem value="annual">Anual</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Dia de vencimento</Label><Input type="number" min={1} max={31} value={f.due_day} onChange={(e) => setF({ ...f, due_day: Number(e.target.value) })} /></div>
              <div><Label>Comissão (%)</Label><Input type="number" step="0.01" min={0} value={f.commission_pct} onChange={(e) => setF({ ...f, commission_pct: Number(e.target.value) })} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={f.active} onCheckedChange={(v) => setF({ ...f, active: !!v })} />
              Ativo
            </label>
          </div>
          <DialogFooter><Button onClick={() => save.mutate(f)}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Table>
        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Recorrência</TableHead><TableHead>Vence dia</TableHead><TableHead className="text-right">Comissão</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((i: any) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">{i.name} {!i.active && <Badge variant="outline" className="ml-1">inativo</Badge>}</TableCell>
              <TableCell>{i.category ?? "—"}</TableCell>
              <TableCell>{i.recurrence === "monthly" ? "Mensal" : "Anual"}</TableCell>
              <TableCell>{i.due_day ?? "—"}</TableCell>
              <TableCell className="text-right">{Number(i.commission_pct ?? 0) > 0 ? `${Number(i.commission_pct)}%` : "—"}</TableCell>
              <TableCell className="text-right">{fmtBRL(Number(i.amount))}</TableCell>
              <TableCell className="text-right">
                {canEdit && <>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(i.id); }}><Trash2 className="h-4 w-4" /></Button>
                </>}
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum custo fixo</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}

// ============================ RECEITAS RECORRENTES ============================

function RecurringIncomes() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("gerente");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const { data: items = [] } = useQuery({ queryKey: ["recurring_incomes"], queryFn: async () => (await supabase.from("recurring_incomes").select("*, clients(name)").order("description")).data ?? [] });
  const { data: clients = [] } = useQuery({ queryKey: ["clients-mini"], queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [] });
  const { data: incomeCats = [] } = useFinancialCategories("income");
  const empty = { client_id: null as string | null, description: "", amount: 0, commission_pct: 0, recurrence: "monthly", next_due: new Date().toISOString().slice(0, 10), active: true, category_id: null as string | null };
  const [f, setF] = useState<any>(empty);

  const save = useMutation({
    mutationFn: async (form: any) => {
      if (editing) {
        const { error } = await supabase.from("recurring_incomes").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("recurring_incomes").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recurring_incomes"] }); setOpen(false); setEditing(null); setF(empty); toast.success("Salvo"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("recurring_incomes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring_incomes"] }),
  });

  const openNew = () => { setEditing(null); setF(empty); setOpen(true); };
  const openEdit = (i: any) => {
    setEditing(i);
    setF({
      client_id: i.client_id, description: i.description, amount: Number(i.amount),
      commission_pct: Number(i.commission_pct ?? 0),
      recurrence: i.recurrence ?? "monthly",
      next_due: i.next_due ?? new Date().toISOString().slice(0, 10),
      active: i.active,
      category_id: i.category_id ?? null,
    });
    setOpen(true);
  };

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Receitas recorrentes</h3>
        {canEdit && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova</Button>}
      </div>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setF(empty); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar receita recorrente" : "Nova receita recorrente"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente</Label>
              <Select value={f.client_id ?? "none"} onValueChange={(v) => setF({ ...f, client_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Descrição</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></div>
              <div>
                <Label>Recorrência</Label>
                <Select value={f.recurrence} onValueChange={(v) => setF({ ...f, recurrence: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="monthly">Mensal</SelectItem><SelectItem value="annual">Anual</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Próximo vencimento</Label><Input type="date" value={f.next_due} onChange={(e) => setF({ ...f, next_due: e.target.value })} /></div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={f.category_id ?? "__none__"} onValueChange={(v) => setF({ ...f, category_id: v === "__none__" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— sem categoria —</SelectItem>
                  {incomeCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Comissão (%)</Label><Input type="number" step="0.01" min={0} value={f.commission_pct} onChange={(e) => setF({ ...f, commission_pct: Number(e.target.value) })} /></div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={f.active} onCheckedChange={(v) => setF({ ...f, active: !!v })} />
              Ativa
            </label>
          </div>
          <DialogFooter><Button onClick={() => save.mutate(f)}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Table>
        <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Descrição</TableHead><TableHead>Recorrência</TableHead><TableHead>Próx. vencimento</TableHead><TableHead className="text-right">Comissão</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((i: any) => (
            <TableRow key={i.id}>
              <TableCell>{i.clients?.name ?? "—"}</TableCell>
              <TableCell className="font-medium">{i.description} {!i.active && <Badge variant="outline" className="ml-1">inativa</Badge>}</TableCell>
              <TableCell>{i.recurrence === "monthly" ? "Mensal" : "Anual"}</TableCell>
              <TableCell>{i.next_due ? format(parseISO(i.next_due), "dd/MM/yyyy") : "—"}</TableCell>
              <TableCell className="text-right">{Number(i.commission_pct ?? 0) > 0 ? `${Number(i.commission_pct)}%` : "—"}</TableCell>
              <TableCell className="text-right">{fmtBRL(Number(i.amount))}</TableCell>
              <TableCell className="text-right">
                {canEdit && <>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(i.id); }}><Trash2 className="h-4 w-4" /></Button>
                </>}
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma receita recorrente</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}

// ============================ AUTORIZAÇÕES ============================

function Autorizacoes() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("gerente");
  const qc = useQueryClient();
  const [monthRef, setMonthRef] = useState(format(new Date(), "yyyy-MM"));
  const refDate = parseISO(`${monthRef}-01`);
  const monthStart = startOfMonth(refDate);
  const monthEnd = endOfMonth(refDate);

  const { data: recurring = [] } = useQuery({
    queryKey: ["recurring_incomes", "active"],
    queryFn: async () => (await supabase.from("recurring_incomes").select("*, clients(name)").eq("active", true).order("description")).data ?? [],
  });
  const { data: fixed = [] } = useQuery({
    queryKey: ["fixed_costs", "active"],
    queryFn: async () => (await supabase.from("fixed_costs").select("*").eq("active", true).order("name")).data ?? [],
  });
  const { data: entries = [] } = useQuery({
    queryKey: ["financial_entries"],
    queryFn: async () => (await supabase.from("financial_entries").select("*")).data ?? [],
  });

  const monthEntries = entries.filter((e: any) => {
    const d = parseISO(e.entry_date);
    return d >= monthStart && d <= monthEnd;
  });

  const createdBeforeOrInMonth = (createdAt?: string | null) =>
    !createdAt || new Date(createdAt) <= monthEnd;

  const pendingRecur = recurring.filter((r: any) =>
    createdBeforeOrInMonth(r.created_at) &&
    !findEntryForSource({ id: r.id, kind: "income", description: r.description }, monthEntries as any),
  );
  const pendingFixed = fixed.filter((c: any) =>
    createdBeforeOrInMonth(c.created_at) &&
    !findEntryForSource({ id: c.id, kind: "expense", description: c.name }, monthEntries as any),
  );

  const confirmIncome = useMutation({
    mutationFn: async (r: any) => {
      const dup = findEntryForSource({ id: r.id, kind: "income", description: r.description }, monthEntries as any);
      if (dup) throw new Error("Já confirmado neste mês");
      const { data: u } = await supabase.auth.getUser();
      const d = new Date(refDate);
      d.setDate(Math.min(d.getDate() || 1, endOfMonth(refDate).getDate()));
      const { error } = await supabase.from("financial_entries").insert({
        kind: "income", entry_date: d.toISOString().slice(0, 10),
        description: r.description, amount: r.amount, client_id: r.client_id ?? null,
        category: "Recorrente", created_by: u.user?.id,
        source_type: "recurring_income", source_id: r.id,
      });
      if (error) {
        if ((error as any).code === "23505") throw new Error("Já confirmado neste mês");
        throw error;
      }
      const commPct = Number(r.commission_pct ?? 0);
      if (commPct > 0) {
        const commAmount = (Number(r.amount) * commPct) / 100;
        const { error: cErr } = await supabase.from("financial_entries").insert({
          kind: "expense", entry_date: d.toISOString().slice(0, 10),
          description: `Comissão — ${r.description}`, amount: commAmount,
          client_id: r.client_id ?? null, category: "Comissão",
          created_by: u.user?.id,
          source_type: "recurring_income_commission", source_id: r.id,
        });
        if (cErr && (cErr as any).code !== "23505") throw cErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_entries"] });
      toast.success("Receita autorizada — adicionada aos Lançamentos");
    },
    onError: (e: any) => (e.message === "Já confirmado neste mês" ? toast.info(e.message) : toast.error(e.message)),
  });

  const confirmExpense = useMutation({
    mutationFn: async (c: any) => {
      const dup = findEntryForSource({ id: c.id, kind: "expense", description: c.name }, monthEntries as any);
      if (dup) throw new Error("Já confirmado neste mês");
      const { data: u } = await supabase.auth.getUser();
      const day = c.due_day ?? 1;
      const d = new Date(refDate);
      d.setDate(Math.min(day, endOfMonth(refDate).getDate()));
      const amount = c.recurrence === "annual" ? Number(c.amount) / 12 : Number(c.amount);
      const { error } = await supabase.from("financial_entries").insert({
        kind: "expense", entry_date: d.toISOString().slice(0, 10),
        description: c.name, amount, category: c.category ?? "Custo fixo",
        created_by: u.user?.id,
        source_type: "fixed_cost", source_id: c.id,
      });
      if (error) {
        if ((error as any).code === "23505") throw new Error("Já confirmado neste mês");
        throw error;
      }
      const commPct = Number(c.commission_pct ?? 0);
      if (commPct > 0) {
        const commAmount = (amount * commPct) / 100;
        const { error: cErr } = await supabase.from("financial_entries").insert({
          kind: "expense", entry_date: d.toISOString().slice(0, 10),
          description: `Comissão — ${c.name}`, amount: commAmount,
          category: "Comissão", created_by: u.user?.id,
          source_type: "fixed_cost_commission", source_id: c.id,
        });
        if (cErr && (cErr as any).code !== "23505") throw cErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_entries"] });
      toast.success("Pagamento autorizado — adicionado aos Lançamentos");
    },
    onError: (e: any) => (e.message === "Já confirmado neste mês" ? toast.info(e.message) : toast.error(e.message)),
  });

  const deleteRecurring = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_incomes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recurring_incomes", "active"] }); toast.success("Receita recorrente excluída"); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteFixed = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fixed_costs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fixed_costs", "active"] }); toast.success("Custo fixo excluído"); },
    onError: (e: any) => toast.error(e.message),
  });

  const totalReceber = pendingRecur.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const totalPagar = pendingFixed.reduce(
    (s: number, c: any) => s + (c.recurrence === "annual" ? Number(c.amount) / 12 : Number(c.amount)),
    0,
  );

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <Label htmlFor="auth-month">Mês de referência</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Autorize as receitas recorrentes e os custos fixos do mês. Ao confirmar, o item vira um lançamento.
            Excluir remove a recorrência permanentemente.
          </p>
        </div>
        <Input
          id="auth-month"
          type="month"
          value={monthRef}
          onChange={(e) => setMonthRef(e.target.value || format(new Date(), "yyyy-MM"))}
          className="w-full sm:w-48"
        />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Receitas a autorizar */}
        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-medium text-green-700">Receitas a autorizar</h3>
              <p className="text-xs text-muted-foreground">Total pendente: <span className="font-medium text-foreground">{fmtBRL(totalReceber)}</span></p>
            </div>
            <Badge variant="secondary">{pendingRecur.length}</Badge>
          </div>
          <div className="space-y-2 flex-1">
            {pendingRecur.map((r: any) => (
              <div key={r.id} className="p-3 rounded-md border space-y-2">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{r.description}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{r.clients?.name ?? "—"}</p>
                  </div>
                  <p className="text-sm text-green-600 font-medium whitespace-nowrap">{fmtBRL(Number(r.amount))}</p>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8" onClick={() => confirmIncome.mutate(r)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />Recebido
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => { if (confirm("Excluir esta receita recorrente permanentemente?")) deleteRecurring.mutate(r.id); }}>
                      <Trash2 className="h-3 w-3 mr-1" />Excluir
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {pendingRecur.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Tudo autorizado este mês ✓</p>}
          </div>
        </Card>

        {/* Custos a autorizar */}
        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-medium text-red-700">Custos a autorizar</h3>
              <p className="text-xs text-muted-foreground">Total pendente: <span className="font-medium text-foreground">{fmtBRL(totalPagar)}</span></p>
            </div>
            <Badge variant="secondary">{pendingFixed.length}</Badge>
          </div>
          <div className="space-y-2 flex-1">
            {pendingFixed.map((c: any) => {
              const monthly = c.recurrence === "annual" ? Number(c.amount) / 12 : Number(c.amount);
              return (
                <div key={c.id} className="p-3 rounded-md border space-y-2">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{c.category ?? "—"}{c.due_day ? ` · vence dia ${c.due_day}` : ""}</p>
                    </div>
                    <p className="text-sm text-red-600 font-medium whitespace-nowrap">{fmtBRL(monthly)}</p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 h-8" onClick={() => confirmExpense.mutate(c)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" />Pago
                      </Button>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => { if (confirm("Excluir este custo fixo permanentemente?")) deleteFixed.mutate(c.id); }}>
                        <Trash2 className="h-3 w-3 mr-1" />Excluir
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {pendingFixed.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Tudo autorizado este mês ✓</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================ RELATÓRIO ============================

function Relatorio() {
  const today = new Date();
  const [from, setFrom] = useState(startOfMonth(today).toISOString().slice(0, 10));
  const [to, setTo] = useState(endOfMonth(today).toISOString().slice(0, 10));

  const { data: entries = [], isFetching, refetch } = useQuery({
    queryKey: ["report_entries", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*, projects(title), clients(name)")
        .gte("entry_date", from)
        .lte("entry_date", to)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const totals = useMemo(() => {
    const incomes = entries.filter((e) => e.kind === "income").reduce((s, e) => s + Number(e.amount), 0);
    const expenses = entries.filter((e) => e.kind === "expense").reduce((s, e) => s + Number(e.amount), 0);
    const comissoes = entries
      .filter((e) => e.kind === "income" && (e.category ?? "").toLowerCase().includes("comiss"))
      .reduce((s, e) => s + Number(e.amount), 0);
    const byCat: Record<string, number> = {};
    entries.forEach((e) => {
      const k = (e.category ?? "Sem categoria").trim() || "Sem categoria";
      byCat[k] = (byCat[k] ?? 0) + Number(e.amount);
    });
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { incomes, expenses, saldo: incomes - expenses, comissoes, topCat };
  }, [entries]);

  const exportCSV = () => {
    const headers = ["Data", "Tipo", "Descrição", "Categoria", "Projeto/Cliente", "Valor"];
    const rows = entries.map((e: any) => [
      format(parseISO(e.entry_date), "dd/MM/yyyy"),
      e.kind === "income" ? "Entrada" : "Saída",
      (e.description ?? "").replace(/"/g, '""'),
      (e.category ?? "").replace(/"/g, '""'),
      (e.projects?.title ?? e.clients?.name ?? "").replace(/"/g, '""'),
      Number(e.amount).toFixed(2).replace(".", ","),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_financeiro_${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="p-4 print:hidden">
        <h3 className="font-medium mb-3">Emitir relatório</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={() => refetch()} disabled={isFetching}>Gerar relatório</Button>
          <Button variant="outline" onClick={exportCSV} disabled={!entries.length}><FileDown className="h-4 w-4 mr-2" />CSV</Button>
          <Button variant="outline" onClick={() => window.print()} disabled={!entries.length}><Printer className="h-4 w-4 mr-2" />Imprimir / PDF</Button>
        </div>
      </Card>

      <div id="relatorio-print" className="space-y-6">
        <Card className="p-4">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-medium">Relatório financeiro</h3>
            <span className="text-sm text-muted-foreground">
              {format(parseISO(from), "dd/MM/yyyy")} a {format(parseISO(to), "dd/MM/yyyy")}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Receitas" value={fmtBRL(totals.incomes)} icon={<TrendingUp className="h-4 w-4 text-green-600" />} />
            <Stat label="Despesas" value={fmtBRL(totals.expenses)} icon={<TrendingDown className="h-4 w-4 text-red-600" />} />
            <Stat label="Saldo" value={fmtBRL(totals.saldo)} highlight={totals.saldo >= 0 ? "pos" : "neg"} />
            <Stat label="Comissões" value={fmtBRL(totals.comissoes)} />
          </div>
          {totals.topCat.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium mb-2">Top categorias</p>
              <div className="space-y-1">
                {totals.topCat.map(([cat, val]) => (
                  <div key={cat} className="flex justify-between text-sm border-b py-1">
                    <span>{cat}</span>
                    <span className="font-medium">{fmtBRL(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h4 className="font-medium mb-3">Lançamentos ({entries.length})</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Projeto / Cliente</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell>{format(parseISO(i.entry_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{i.kind === "income" ? "Entrada" : "Saída"}</TableCell>
                  <TableCell className="font-medium">{i.description}</TableCell>
                  <TableCell className="text-muted-foreground">{i.category ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{i.projects?.title ?? i.clients?.name ?? "—"}</TableCell>
                  <TableCell className={`text-right font-medium ${i.kind === "income" ? "text-green-600" : "text-red-600"}`}>{fmtBRL(Number(i.amount))}</TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum lançamento no período</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

// ============================ CONFIGURAÇÕES ============================

function SettingsTab() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("gerente");
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["financial_settings"],
    queryFn: async () => (await supabase.from("financial_settings").select("*").eq("id", true).maybeSingle()).data,
  });
  const [tax, setTax] = useState<number | null>(null);
  const [comm, setComm] = useState<number | null>(null);
  const taxV = tax ?? Number(data?.tax_pct ?? 6);
  const commV = comm ?? Number(data?.default_commission_pct ?? 0);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("financial_settings").update({ tax_pct: taxV, default_commission_pct: commV }).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financial_settings"] }); toast.success("Salvo"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="p-6 space-y-4">
        <h3 className="font-medium">Configurações financeiras</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Alíquota de imposto padrão (%)</Label><Input type="number" step="0.1" value={taxV} onChange={(e) => setTax(Number(e.target.value))} disabled={!canEdit} /></div>
          <div><Label>Comissão padrão (%)</Label><Input type="number" step="0.1" value={commV} onChange={(e) => setComm(Number(e.target.value))} disabled={!canEdit} /></div>
        </div>
        {canEdit && <Button onClick={() => save.mutate()}>Salvar</Button>}
      </Card>

      <CategoriesSettings canEdit={canEdit} />
    </div>
  );
}

function CategoriesSettings({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery({
    queryKey: ["financial_categories", "all"],
    queryFn: async () => (await supabase.from("financial_categories").select("id, name, kind, is_fixed, sort_order").order("kind").order("sort_order")).data as FinCat[] ?? [],
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<FinCat> | null>(null);

  const save = useMutation({
    mutationFn: async (f: Partial<FinCat>) => {
      if (!f.name?.trim() || !f.kind) throw new Error("Nome e tipo são obrigatórios");
      if (f.id) {
        const { error } = await supabase.from("financial_categories").update({ name: f.name, kind: f.kind, is_fixed: !!f.is_fixed, updated_at: new Date().toISOString() }).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_categories").insert({ name: f.name, kind: f.kind, is_fixed: !!f.is_fixed } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financial_categories"] }); toast.success("Salvo"); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("financial_categories").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financial_categories"] }),
  });
  const toggleFixed = useMutation({
    mutationFn: async (c: FinCat) => { const { error } = await supabase.from("financial_categories").update({ is_fixed: !c.is_fixed }).eq("id", c.id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financial_categories"] }),
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Categorias financeiras</h3>
          <p className="text-xs text-muted-foreground">Marque quais categorias compõem os custos fixos.</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => { setEditing({ name: "", kind: "expense", is_fixed: false }); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova categoria
          </Button>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Custo fixo</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cats.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell>{c.kind === "expense" ? "Saída" : "Entrada"}</TableCell>
              <TableCell>
                <Checkbox
                  checked={c.is_fixed}
                  disabled={!canEdit || c.kind !== "expense"}
                  onCheckedChange={() => toggleFixed.mutate(c)}
                />
              </TableCell>
              <TableCell className="text-right">
                {canEdit && <>
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remover "${c.name}"?`)) del.mutate(c.id); }}><Trash2 className="h-4 w-4" /></Button>
                </>}
              </TableCell>
            </TableRow>
          ))}
          {cats.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhuma categoria cadastrada</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={editing.kind ?? "expense"} onValueChange={(v) => setEditing({ ...editing, kind: v as "expense" | "income" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Saída (despesa)</SelectItem>
                    <SelectItem value="income">Entrada (receita)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editing.kind === "expense" && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={!!editing.is_fixed} onCheckedChange={(v) => setEditing({ ...editing, is_fixed: !!v })} />
                  Compõe os custos fixos
                </label>
              )}
              <DialogFooter>
                <Button onClick={() => save.mutate(editing)} disabled={save.isPending}>Salvar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================ SHARE LINK + SOLICITAÇÕES ============================

function ShareLancamentoLink() {
  const url = typeof window !== "undefined" ? `${window.location.origin}/lancamento` : "/lancamento";
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Link2 className="h-4 w-4 mr-2" />Link de envio</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Compartilhar link do formulário</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Qualquer pessoa com este link pode enviar um lançamento. As solicitações caem na aba
            "Solicitações" e só entram no financeiro após sua aprovação.
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={url} className="font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
            <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }} title="Copiar">
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" asChild title="Abrir">
              <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Solicitacoes() {
  const { roles } = useAuth();
  const canManage = roles.includes("admin") || roles.includes("gerente");
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pendente" | "aprovado" | "rejeitado">("pendente");
  const [selected, setSelected] = useState<any | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { data: reqs = [], isLoading } = useQuery({
    queryKey: ["financial_entry_requests", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entry_requests")
        .select("*, financial_categories(name)")
        .eq("status", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["financial_entry_requests_count_pendente"],
    queryFn: async () => {
      const { count } = await supabase
        .from("financial_entry_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente");
      return count ?? 0;
    },
  });

  const approve = useMutation({
    mutationFn: async (r: any) => {
      const { data: u } = await supabase.auth.getUser();
      const { data: entry, error: insErr } = await supabase
        .from("financial_entries")
        .insert({
          kind: r.kind,
          entry_date: r.entry_date,
          description: r.description,
          amount: r.amount,
          category_id: r.category_id,
          category: r.financial_categories?.name ?? null,
          receipt_path: r.receipt_path,
          source_type: "manual",
          created_by: u.user?.id,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      const { error } = await supabase
        .from("financial_entry_requests")
        .update({
          status: "aprovado",
          reviewed_by: u.user?.id,
          reviewed_at: new Date().toISOString(),
          created_entry_id: entry.id,
        })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_entry_requests"] });
      qc.invalidateQueries({ queryKey: ["financial_entry_requests_count_pendente"] });
      qc.invalidateQueries({ queryKey: ["financial_entries"] });
      setSelected(null);
      toast.success("Lançamento aprovado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async ({ r, reason }: { r: any; reason: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("financial_entry_requests")
        .update({
          status: "rejeitado",
          review_notes: reason || null,
          reviewed_by: u.user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_entry_requests"] });
      qc.invalidateQueries({ queryKey: ["financial_entry_requests_count_pendente"] });
      setRejectOpen(false); setRejectReason(""); setSelected(null);
      toast.success("Solicitação rejeitada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_entry_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_entry_requests"] });
      qc.invalidateQueries({ queryKey: ["financial_entry_requests_count_pendente"] });
      setSelected(null);
      toast.success("Removido");
    },
  });

  const openReceipt = async (path: string) => {
    const { data, error } = await supabase.storage.from("financial-receipts").createSignedUrl(path, 60);
    if (error) { toast.error("Não foi possível abrir o comprovante"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
        <div>
          <h3 className="font-medium">Solicitações de lançamento</h3>
          <p className="text-xs text-muted-foreground">Enviadas pelo formulário público de envio.</p>
        </div>
        <ShareLancamentoLink />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pendente">
            Pendentes {pendingCount > 0 && <Badge variant="secondary" className="ml-2">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="aprovado">Aprovadas</TabsTrigger>
          <TabsTrigger value="rejeitado">Rejeitadas</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : reqs.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Nenhuma solicitação {tab}.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reqs.map((r: any) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(r)}>
                    <TableCell>{format(parseISO(r.entry_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell><Badge variant={r.kind === "income" ? "default" : "secondary"}>{r.kind === "income" ? "Entrada" : "Saída"}</Badge></TableCell>
                    <TableCell className="font-medium">{r.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.requester_name}<div className="text-[10px]">{r.requester_email}</div></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.financial_categories?.name ?? "—"}</TableCell>
                    <TableCell className={`text-right font-medium ${r.kind === "income" ? "text-green-600" : "text-red-600"}`}>{fmtBRL(Number(r.amount))}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {tab === "pendente" && canManage && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title="Aprovar" onClick={() => approve.mutate(r)}>
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Rejeitar" onClick={() => { setSelected(r); setRejectOpen(true); }}>
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={!!selected && !rejectOpen} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader><SheetTitle className="pr-8">{selected.description}</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span>{selected.kind === "income" ? "Entrada" : "Saída"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span>{format(parseISO(selected.entry_date), "dd/MM/yyyy")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-medium">{fmtBRL(Number(selected.amount))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Categoria</span><span>{selected.financial_categories?.name ?? "—"}</span></div>
                <div className="border-t pt-3">
                  <div className="text-muted-foreground text-xs">Solicitante</div>
                  <div>{selected.requester_name}</div>
                  <div className="text-xs text-muted-foreground">{selected.requester_email}</div>
                </div>
                {selected.requester_notes && (
                  <div className="border-t pt-3">
                    <div className="text-muted-foreground text-xs mb-1">Observações</div>
                    <div className="whitespace-pre-wrap">{selected.requester_notes}</div>
                  </div>
                )}
                {selected.receipt_path && (
                  <div className="border-t pt-3">
                    <Button size="sm" variant="outline" onClick={() => openReceipt(selected.receipt_path)}>
                      <Download className="h-4 w-4 mr-2" />Ver comprovante
                    </Button>
                  </div>
                )}
                {selected.review_notes && (
                  <div className="border-t pt-3">
                    <div className="text-muted-foreground text-xs mb-1">Motivo</div>
                    <div className="whitespace-pre-wrap">{selected.review_notes}</div>
                  </div>
                )}
                {canManage && (
                  <div className="border-t pt-4 flex flex-wrap gap-2">
                    {selected.status === "pendente" && (
                      <>
                        <Button size="sm" onClick={() => approve.mutate(selected)} disabled={approve.isPending}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />Aprovar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
                          <XCircle className="h-4 w-4 mr-2" />Rejeitar
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="text-red-600 ml-auto" onClick={() => { if (confirm("Remover esta solicitação?")) del.mutate(selected.id); }}>
                      <Trash2 className="h-4 w-4 mr-2" />Excluir
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar solicitação</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Textarea rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Explique brevemente..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => selected && reject.mutate({ r: selected, reason: rejectReason })} disabled={reject.isPending}>Rejeitar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
