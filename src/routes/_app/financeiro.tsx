import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, TrendingUp, TrendingDown, Receipt, Wrench, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { startOfMonth, endOfMonth, subMonths, format, parseISO, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/financeiro")({ component: FinanceiroPage });

const fmtBRL = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function FinanceiroPage() {
  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Resumo, custos, receitas e lançamentos.</p>
      </div>
      <Tabs defaultValue="resumo">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="confirmar">Confirmações do mês</TabsTrigger>
          <TabsTrigger value="entradas">Lançamentos</TabsTrigger>
          <TabsTrigger value="fixos">Custos fixos</TabsTrigger>
          <TabsTrigger value="recorrentes">Receitas recorrentes</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>
        <TabsContent value="resumo" className="mt-6"><Resumo /></TabsContent>
        <TabsContent value="confirmar" className="mt-6"><Confirmacoes /></TabsContent>
        <TabsContent value="entradas" className="mt-6"><Entries /></TabsContent>
        <TabsContent value="fixos" className="mt-6"><FixedCosts /></TabsContent>
        <TabsContent value="recorrentes" className="mt-6"><RecurringIncomes /></TabsContent>
        <TabsContent value="config" className="mt-6"><Settings /></TabsContent>
      </Tabs>
    </div>
  );
}

function Resumo() {
  const { data: entries = [] } = useQuery({
    queryKey: ["financial_entries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_entries").select("*");
      if (error) throw error;
      return data as any[];
    },
  });
  const { data: fixed = [] } = useQuery({
    queryKey: ["fixed_costs"],
    queryFn: async () => (await supabase.from("fixed_costs").select("*").eq("active", true)).data ?? [],
  });
  const { data: equipments = [] } = useQuery({
    queryKey: ["equipments"],
    queryFn: async () => (await supabase.from("equipments").select("*").eq("active", true)).data ?? [],
  });
  const { data: settings } = useQuery({
    queryKey: ["financial_settings"],
    queryFn: async () => (await supabase.from("financial_settings").select("*").eq("id", true).maybeSingle()).data,
  });
  const { data: recurring = [] } = useQuery({
    queryKey: ["recurring_incomes"],
    queryFn: async () => (await supabase.from("recurring_incomes").select("*").eq("active", true)).data ?? [],
  });

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const monthEntries = entries.filter((e) => {
    const d = parseISO(e.entry_date);
    return d >= monthStart && d <= monthEnd;
  });
  const incomes = monthEntries.filter((e) => e.kind === "income").reduce((s, e) => s + Number(e.amount), 0);
  const expenses = monthEntries.filter((e) => e.kind === "expense").reduce((s, e) => s + Number(e.amount), 0);
  const fixedMonthly = fixed.reduce((s: number, c: any) => s + (c.recurrence === "annual" ? Number(c.amount) / 12 : Number(c.amount)), 0);
  const taxes = incomes * (Number(settings?.tax_pct ?? 0) / 100);
  const depreciation = equipments.reduce((s: number, e: any) => s + (Number(e.acquisition_value) * Number(e.depreciation_pct_year) / 100) / 12, 0);

  const fixedMonthlyOf = (c: any) => c.recurrence === "annual" ? Number(c.amount) / 12 : Number(c.amount);

  // 12-month chart — Saídas inclui despesas avulsas + custos fixos rateados + impostos + depreciação
  const taxPct = Number(settings?.tax_pct ?? 0) / 100;
  const chart = Array.from({ length: 12 }, (_, idx) => {
    const ref = subMonths(new Date(), 11 - idx);
    const s = startOfMonth(ref), e = endOfMonth(ref);
    const set = entries.filter((x) => { const d = parseISO(x.entry_date); return d >= s && d <= e; });
    const ent = set.filter((x) => x.kind === "income").reduce((a, b) => a + Number(b.amount), 0);
    const expAvulsas = set.filter((x) => x.kind === "expense").reduce((a, b) => a + Number(b.amount), 0);
    const sai = expAvulsas + fixedMonthly + (ent * taxPct) + depreciation;
    return {
      mes: format(ref, "MMM/yy", { locale: ptBR }),
      Entradas: ent,
      Saidas: sai,
      Resultado: ent - sai,
    };
  });

  // Previsão do mês — recorrências esperadas + lançamentos do mês
  const recurringExpectedIncome = recurring.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const receitasPrevistas = Math.max(recurringExpectedIncome, incomes) + Math.max(0, incomes - recurringExpectedIncome);
  // simplificação: previsão = max(esperado, já lançado) — ignora dupla contagem
  const receitasPrev = Math.max(recurringExpectedIncome, incomes);
  const despesasPrev = Math.max(expenses, 0) + fixedMonthly + (receitasPrev * taxPct) + depreciation;
  const saldoPrev = receitasPrev - despesasPrev;
  const saldoReal = incomes - expenses;

  const recurringCount = recurring.length;
  const recurringConfirmed = recurring.filter((r: any) =>
    monthEntries.some((m) => m.kind === "income" && (m.description ?? "").trim().toLowerCase() === (r.description ?? "").trim().toLowerCase())
  ).length;

  const liquido = incomes - expenses - fixedMonthly - taxes - depreciation;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Stat label="Entradas (mês)" value={fmtBRL(incomes)} icon={<TrendingUp className="h-4 w-4 text-green-600" />} />
        <Stat label="Saídas (mês)" value={fmtBRL(expenses)} icon={<TrendingDown className="h-4 w-4 text-red-600" />} />
        <Stat label="Custos fixos (mês)" value={fmtBRL(fixedMonthly)} icon={<Receipt className="h-4 w-4" />} />
        <Stat label={`Impostos (${settings?.tax_pct ?? 0}%)`} value={fmtBRL(taxes)} icon={<Receipt className="h-4 w-4" />} />
        <Stat label="Depreciação (mês)" value={fmtBRL(depreciation)} icon={<Wrench className="h-4 w-4" />} />
        <Stat label="Resultado líquido" value={fmtBRL(liquido)} highlight={liquido >= 0 ? "pos" : "neg"} />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Previsão do mês</h3>
          <span className="text-xs text-muted-foreground">{format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Receitas previstas" value={fmtBRL(receitasPrev)} icon={<TrendingUp className="h-4 w-4 text-green-600" />} />
          <Stat label="Despesas previstas" value={fmtBRL(despesasPrev)} icon={<TrendingDown className="h-4 w-4 text-red-600" />} />
          <Stat label="Saldo previsto" value={fmtBRL(saldoPrev)} highlight={saldoPrev >= 0 ? "pos" : "neg"} />
          <Stat label="Saldo realizado" value={fmtBRL(saldoReal)} highlight={saldoReal >= 0 ? "pos" : "neg"} />
        </div>
        {recurringCount > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Receitas recorrentes recebidas</span>
              <span className="font-medium">{recurringConfirmed} de {recurringCount}</span>
            </div>
            <Progress value={(recurringConfirmed / recurringCount) * 100} />
          </div>
        )}
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
              <Bar dataKey="Entradas" fill="hsl(142 70% 45%)" />
              <Bar dataKey="Saidas" fill="hsl(0 70% 55%)" />
              <Line type="monotone" dataKey="Resultado" stroke="hsl(221 83% 53%)" strokeWidth={2} dot={{ r: 3 }} />
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

function Entries() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("gerente");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

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
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("financial_entries").insert({ ...form, created_by: u.user?.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financial_entries"] }); setOpen(false); toast.success("Salvo"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("financial_entries").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financial_entries"] }); toast.success("Removido"); },
  });

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Entradas e saídas avulsas</h3>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Novo lançamento</Button></DialogTrigger>
            <EntryForm projects={projects} clients={clients} onSubmit={(f) => save.mutate(f)} />
          </Dialog>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Projeto / Cliente</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((i: any) => (
            <TableRow key={i.id}>
              <TableCell>{format(parseISO(i.entry_date), "dd/MM/yyyy")}</TableCell>
              <TableCell><Badge variant={i.kind === "income" ? "default" : "secondary"}>{i.kind === "income" ? "Entrada" : "Saída"}</Badge></TableCell>
              <TableCell className="font-medium">{i.description}</TableCell>
              <TableCell className="text-muted-foreground">{i.category ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{i.projects?.title ?? i.clients?.name ?? "—"}</TableCell>
              <TableCell className={`text-right font-medium ${i.kind === "income" ? "text-green-600" : "text-red-600"}`}>{fmtBRL(Number(i.amount))}</TableCell>
              <TableCell>{canEdit && <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(i.id); }}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
            </TableRow>
          ))}
          {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum lançamento</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}

function EntryForm({ projects, clients, onSubmit }: { projects: any[]; clients: any[]; onSubmit: (f: any) => void }) {
  const [f, setF] = useState({
    kind: "income", entry_date: new Date().toISOString().slice(0, 10),
    description: "", category: "", amount: 0, project_id: null as string | null, client_id: null as string | null,
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
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
          <div><Label>Categoria</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
          <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></div>
        </div>
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

function FixedCosts() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("gerente");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: items = [] } = useQuery({ queryKey: ["fixed_costs"], queryFn: async () => (await supabase.from("fixed_costs").select("*").order("name")).data ?? [] });
  const save = useMutation({
    mutationFn: async (f: any) => { const { error } = await supabase.from("fixed_costs").insert(f); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fixed_costs"] }); setOpen(false); toast.success("Salvo"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("fixed_costs").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixed_costs"] }),
  });
  const [f, setF] = useState({ name: "", category: "", amount: 0, recurrence: "monthly", due_day: 5, active: true });

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Custos fixos</h3>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Novo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo custo fixo</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Categoria</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
                  <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Recorrência</Label>
                    <Select value={f.recurrence} onValueChange={(v) => setF({ ...f, recurrence: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="monthly">Mensal</SelectItem><SelectItem value="annual">Anual</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Dia de vencimento</Label><Input type="number" min={1} max={31} value={f.due_day} onChange={(e) => setF({ ...f, due_day: Number(e.target.value) })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={() => save.mutate(f)}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Recorrência</TableHead><TableHead>Vence dia</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((i: any) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">{i.name}</TableCell>
              <TableCell>{i.category ?? "—"}</TableCell>
              <TableCell>{i.recurrence === "monthly" ? "Mensal" : "Anual"}</TableCell>
              <TableCell>{i.due_day ?? "—"}</TableCell>
              <TableCell className="text-right">{fmtBRL(Number(i.amount))}</TableCell>
              <TableCell>{canEdit && <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(i.id); }}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
            </TableRow>
          ))}
          {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum custo fixo</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}

function RecurringIncomes() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("gerente");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: items = [] } = useQuery({ queryKey: ["recurring_incomes"], queryFn: async () => (await supabase.from("recurring_incomes").select("*, clients(name)").order("description")).data ?? [] });
  const { data: clients = [] } = useQuery({ queryKey: ["clients-mini"], queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [] });
  const [f, setF] = useState({ client_id: null as string | null, description: "", amount: 0, recurrence: "monthly", next_due: new Date().toISOString().slice(0, 10), active: true });
  const save = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("recurring_incomes").insert(f as any); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recurring_incomes"] }); setOpen(false); toast.success("Salvo"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("recurring_incomes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring_incomes"] }),
  });

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Receitas recorrentes</h3>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Nova</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova receita recorrente</DialogTitle></DialogHeader>
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
              </div>
              <DialogFooter><Button onClick={() => save.mutate()}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Descrição</TableHead><TableHead>Recorrência</TableHead><TableHead>Próx. vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((i: any) => (
            <TableRow key={i.id}>
              <TableCell>{i.clients?.name ?? "—"}</TableCell>
              <TableCell className="font-medium">{i.description}</TableCell>
              <TableCell>{i.recurrence === "monthly" ? "Mensal" : "Anual"}</TableCell>
              <TableCell>{i.next_due ? format(parseISO(i.next_due), "dd/MM/yyyy") : "—"}</TableCell>
              <TableCell className="text-right">{fmtBRL(Number(i.amount))}</TableCell>
              <TableCell>{canEdit && <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(i.id); }}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
            </TableRow>
          ))}
          {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma receita recorrente</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}

function Settings() {
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
    <Card className="p-6 max-w-xl space-y-4">
      <h3 className="font-medium">Configurações financeiras</h3>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Alíquota de imposto padrão (%)</Label><Input type="number" step="0.1" value={taxV} onChange={(e) => setTax(Number(e.target.value))} disabled={!canEdit} /></div>
        <div><Label>Comissão padrão (%)</Label><Input type="number" step="0.1" value={commV} onChange={(e) => setComm(Number(e.target.value))} disabled={!canEdit} /></div>
      </div>
      {canEdit && <Button onClick={() => save.mutate()}>Salvar</Button>}
    </Card>
  );
}
