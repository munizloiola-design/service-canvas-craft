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
import { Plus, Trash2, TrendingUp, TrendingDown, Receipt, Wrench, CheckCircle2, Pencil, FileDown, Printer } from "lucide-react";
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
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="confirmar">Confirmações do mês</TabsTrigger>
          <TabsTrigger value="entradas">Lançamentos</TabsTrigger>
          <TabsTrigger value="fixos">Custos fixos</TabsTrigger>
          <TabsTrigger value="recorrentes">Receitas recorrentes</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>
        <TabsContent value="resumo" className="mt-6"><Resumo /></TabsContent>
        <TabsContent value="confirmar" className="mt-6"><Confirmacoes /></TabsContent>
        <TabsContent value="entradas" className="mt-6"><Entries /></TabsContent>
        <TabsContent value="fixos" className="mt-6"><FixedCosts /></TabsContent>
        <TabsContent value="recorrentes" className="mt-6"><RecurringIncomes /></TabsContent>
        <TabsContent value="relatorios" className="mt-6"><Relatorios /></TabsContent>
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
  const fixedMonthlyPrevisto = fixed.reduce((s: number, c: any) => s + (c.recurrence === "annual" ? Number(c.amount) / 12 : Number(c.amount)), 0);
  const taxes = incomes * (Number(settings?.tax_pct ?? 0) / 100);
  const depreciation = equipments.reduce((s: number, e: any) => s + (Number(e.acquisition_value) * Number(e.depreciation_pct_year) / 100) / 12, 0);

  // Previsão do mês — separa Realizado / Pendente
  const taxPct = Number(settings?.tax_pct ?? 0) / 100;

  // Receitas pendentes = recorrentes ainda não confirmadas no mês
  const recurringPending = recurring.filter((r: any) =>
    !monthEntries.some((m) => m.kind === "income" && (m.description ?? "").trim().toLowerCase() === (r.description ?? "").trim().toLowerCase())
  );
  const aReceber = recurringPending.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const receitasPrev = incomes + aReceber;

  // Despesas pendentes = custos fixos ainda não confirmados no mês
  const fixedPending = fixed.filter((c: any) =>
    !monthEntries.some((m) => m.kind === "expense" && (m.description ?? "").trim().toLowerCase() === (c.name ?? "").trim().toLowerCase())
  );
  const aPagar = fixedPending.reduce((s: number, c: any) => s + (c.recurrence === "annual" ? Number(c.amount) / 12 : Number(c.amount)), 0);
  // Custos fixos confirmados (realizados) no mês = total previsto - pendentes
  const fixedConfirmedAmount = Math.max(0, fixedMonthlyPrevisto - aPagar);
  const despesasPrev = expenses + aPagar + (receitasPrev * taxPct) + depreciation;
  const saldoPrev = receitasPrev - despesasPrev;
  const saldoReal = incomes - expenses;

  // 12-month chart — exclusivamente entradas reais confirmadas (financial_entries), sem previstos
  const chart = Array.from({ length: 12 }, (_, idx) => {
    const ref = subMonths(new Date(), 11 - idx);
    const s = startOfMonth(ref), e = endOfMonth(ref);
    const set = entries.filter((x) => { const d = parseISO(x.entry_date); return d >= s && d <= e; });
    const ent = set.filter((x) => x.kind === "income").reduce((a, b) => a + Number(b.amount), 0);
    const sai = set.filter((x) => x.kind === "expense").reduce((a, b) => a + Number(b.amount), 0);
    return {
      mes: format(ref, "MMM/yy", { locale: ptBR }),
      Entradas: ent,
      Saidas: sai,
      Resultado: ent - sai,
    };
  });

  const recurringCount = recurring.length;
  const recurringConfirmed = recurringCount - recurringPending.length;
  const fixedCount = fixed.length;
  const fixedConfirmed = fixedCount - fixedPending.length;

  // Resultado líquido considera somente o que já foi realizado/confirmado
  const liquido = incomes - expenses - taxes - depreciation;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Stat label="Entradas (mês)" value={fmtBRL(incomes)} icon={<TrendingUp className="h-4 w-4 text-green-600" />} />
        <Stat label="Saídas (mês)" value={fmtBRL(expenses)} icon={<TrendingDown className="h-4 w-4 text-red-600" />} />
        <Stat label="Custos fixos pagos (mês)" value={fmtBRL(fixedConfirmedAmount)} icon={<Receipt className="h-4 w-4" />} />
        <Stat label={`Impostos (${settings?.tax_pct ?? 0}%)`} value={fmtBRL(taxes)} icon={<Receipt className="h-4 w-4" />} />
        <Stat label="Depreciação (mês)" value={fmtBRL(depreciation)} icon={<Wrench className="h-4 w-4" />} />
        <Stat label="Resultado líquido" value={fmtBRL(liquido)} highlight={liquido >= 0 ? "pos" : "neg"} />
      </div>

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
            <div className="text-sm text-muted-foreground flex justify-between"><span>A receber</span><span className="font-medium text-foreground">{fmtBRL(aReceber)}</span></div>
          </div>
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Despesas</p>
            <p className="text-xl font-semibold text-red-600">{fmtBRL(despesasPrev)} <span className="text-xs text-muted-foreground font-normal">previstas</span></p>
            <div className="text-sm text-muted-foreground flex justify-between"><span>Realizado</span><span className="font-medium text-foreground">{fmtBRL(expenses)}</span></div>
            <div className="text-sm text-muted-foreground flex justify-between"><span>A pagar</span><span className="font-medium text-foreground">{fmtBRL(aPagar)}</span></div>
          </div>
          <Stat label="Saldo previsto" value={fmtBRL(saldoPrev)} highlight={saldoPrev >= 0 ? "pos" : "neg"} />
          <Stat label="Saldo realizado" value={fmtBRL(saldoReal)} highlight={saldoReal >= 0 ? "pos" : "neg"} />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {recurringCount > 0 && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Receitas recorrentes recebidas</span>
                <span className="font-medium">{recurringConfirmed} de {recurringCount}</span>
              </div>
              <Progress value={(recurringConfirmed / recurringCount) * 100} />
            </div>
          )}
          {fixedCount > 0 && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Custos fixos pagos</span>
                <span className="font-medium">{fixedConfirmed} de {fixedCount}</span>
              </div>
              <Progress value={(fixedConfirmed / fixedCount) * 100} />
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-3">Custos fixos e receitas recorrentes só somam ao realizado depois de confirmados na aba "Confirmações do mês".</p>
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
              <TableCell className="font-medium">
                {i.description}
                {(i.category ?? "").toLowerCase() === "comissão" || (i.category ?? "").toLowerCase() === "comissao" ? (
                  <Badge variant="outline" className="ml-2">Comissão</Badge>
                ) : null}
              </TableCell>
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

function FixedCosts() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("gerente");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const { data: items = [] } = useQuery({ queryKey: ["fixed_costs"], queryFn: async () => (await supabase.from("fixed_costs").select("*").order("name")).data ?? [] });
  const empty = { name: "", category: "", amount: 0, recurrence: "monthly", due_day: 5, active: true };
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
    setF({ name: i.name, category: i.category ?? "", amount: Number(i.amount), recurrence: i.recurrence ?? "monthly", due_day: i.due_day ?? 5, active: i.active });
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
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={f.active} onCheckedChange={(v) => setF({ ...f, active: !!v })} />
              Ativo
            </label>
          </div>
          <DialogFooter><Button onClick={() => save.mutate(f)}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Table>
        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Recorrência</TableHead><TableHead>Vence dia</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((i: any) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">{i.name} {!i.active && <Badge variant="outline" className="ml-1">inativo</Badge>}</TableCell>
              <TableCell>{i.category ?? "—"}</TableCell>
              <TableCell>{i.recurrence === "monthly" ? "Mensal" : "Anual"}</TableCell>
              <TableCell>{i.due_day ?? "—"}</TableCell>
              <TableCell className="text-right">{fmtBRL(Number(i.amount))}</TableCell>
              <TableCell className="text-right">
                {canEdit && <>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(i.id); }}><Trash2 className="h-4 w-4" /></Button>
                </>}
              </TableCell>
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
  const [editing, setEditing] = useState<any | null>(null);
  const { data: items = [] } = useQuery({ queryKey: ["recurring_incomes"], queryFn: async () => (await supabase.from("recurring_incomes").select("*, clients(name)").order("description")).data ?? [] });
  const { data: clients = [] } = useQuery({ queryKey: ["clients-mini"], queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [] });
  const empty = { client_id: null as string | null, description: "", amount: 0, recurrence: "monthly", next_due: new Date().toISOString().slice(0, 10), active: true };
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
      recurrence: i.recurrence ?? "monthly",
      next_due: i.next_due ?? new Date().toISOString().slice(0, 10),
      active: i.active,
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
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={f.active} onCheckedChange={(v) => setF({ ...f, active: !!v })} />
              Ativa
            </label>
          </div>
          <DialogFooter><Button onClick={() => save.mutate(f)}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Table>
        <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Descrição</TableHead><TableHead>Recorrência</TableHead><TableHead>Próx. vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((i: any) => (
            <TableRow key={i.id}>
              <TableCell>{i.clients?.name ?? "—"}</TableCell>
              <TableCell className="font-medium">{i.description} {!i.active && <Badge variant="outline" className="ml-1">inativa</Badge>}</TableCell>
              <TableCell>{i.recurrence === "monthly" ? "Mensal" : "Anual"}</TableCell>
              <TableCell>{i.next_due ? format(parseISO(i.next_due), "dd/MM/yyyy") : "—"}</TableCell>
              <TableCell className="text-right">{fmtBRL(Number(i.amount))}</TableCell>
              <TableCell className="text-right">
                {canEdit && <>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(i.id); }}><Trash2 className="h-4 w-4" /></Button>
                </>}
              </TableCell>
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

function Confirmacoes() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("gerente");
  const qc = useQueryClient();
  const [monthRef, setMonthRef] = useState(format(new Date(), "yyyy-MM"));
  const refDate = parseISO(`${monthRef}-01`);
  const monthStart = startOfMonth(refDate);
  const monthEnd = endOfMonth(refDate);

  const { data: recurring = [] } = useQuery({
    queryKey: ["recurring_incomes"],
    queryFn: async () => (await supabase.from("recurring_incomes").select("*, clients(name)").eq("active", true).order("description")).data ?? [],
  });
  const { data: fixed = [] } = useQuery({
    queryKey: ["fixed_costs"],
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

  const isConfirmed = (desc: string, kind: "income" | "expense") =>
    monthEntries.some((m: any) => m.kind === kind && (m.description ?? "").trim().toLowerCase() === (desc ?? "").trim().toLowerCase());

  const findEntry = (desc: string, kind: "income" | "expense") =>
    monthEntries.find((m: any) => m.kind === kind && (m.description ?? "").trim().toLowerCase() === (desc ?? "").trim().toLowerCase());

  const dateInMonth = (day?: number | null) => {
    const d = new Date(refDate);
    const target = day ?? d.getDate();
    d.setDate(Math.min(target, endOfMonth(refDate).getDate()));
    return d.toISOString().slice(0, 10);
  };

  const confirmIncome = useMutation({
    mutationFn: async (r: any) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("financial_entries").insert({
        kind: "income", entry_date: dateInMonth(),
        description: r.description, amount: r.amount, client_id: r.client_id ?? null,
        category: "Recorrente", created_by: u.user?.id,
      });
      if (error) throw error;
      const next = r.next_due ? addMonths(parseISO(r.next_due), 1) : addMonths(refDate, 1);
      await supabase.from("recurring_incomes").update({ next_due: next.toISOString().slice(0, 10) }).eq("id", r.id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financial_entries"] }); qc.invalidateQueries({ queryKey: ["recurring_incomes"] }); toast.success("Recebimento confirmado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const confirmExpense = useMutation({
    mutationFn: async (c: any) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("financial_entries").insert({
        kind: "expense", entry_date: dateInMonth(c.due_day),
        description: c.name, amount: c.amount, category: c.category ?? "Custo fixo",
        created_by: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financial_entries"] }); toast.success("Pagamento confirmado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const unconfirm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financial_entries"] }); toast.success("Desfeito"); },
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <Label htmlFor="conf-month">Mês de referência</Label>
          <p className="text-xs text-muted-foreground mt-1">
            As confirmações abaixo são lançadas no mês selecionado. Custos fixos e receitas recorrentes só entram no realizado depois de confirmados aqui.
          </p>
        </div>
        <Input
          id="conf-month"
          type="month"
          value={monthRef}
          onChange={(e) => setMonthRef(e.target.value || format(new Date(), "yyyy-MM"))}
          className="w-full sm:w-48"
        />
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2 -mb-4 text-xs text-muted-foreground">
          Período: {format(monthStart, "dd/MM/yyyy")} – {format(monthEnd, "dd/MM/yyyy")}
        </div>
      <Card className="p-4">
        <h3 className="font-medium mb-1">Receitas recorrentes a receber</h3>
        <p className="text-xs text-muted-foreground mb-4">Marque as receitas que já entraram este mês.</p>
        <div className="space-y-2">
          {recurring.map((r: any) => {
            const confirmed = isConfirmed(r.description, "income");
            const entry = findEntry(r.description, "income");
            return (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-md border">
                <Checkbox
                  checked={confirmed}
                  disabled={!canEdit}
                  onCheckedChange={(v) => {
                    if (v && !confirmed) confirmIncome.mutate(r);
                    else if (!v && confirmed && entry) unconfirm.mutate(entry.id);
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.description}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.clients?.name ?? "—"} {r.next_due ? `· vence ${format(parseISO(r.next_due), "dd/MM")}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-green-600">{fmtBRL(Number(r.amount))}</p>
                  {confirmed && <Badge variant="secondary" className="mt-1"><CheckCircle2 className="h-3 w-3 mr-1" />Recebido</Badge>}
                </div>
              </div>
            );
          })}
          {recurring.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma receita recorrente cadastrada</p>}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-medium mb-1">Custos fixos a pagar</h3>
        <p className="text-xs text-muted-foreground mb-4">Marque os custos fixos pagos este mês.</p>
        <div className="space-y-2">
          {fixed.map((c: any) => {
            const monthly = c.recurrence === "annual" ? Number(c.amount) / 12 : Number(c.amount);
            const confirmed = isConfirmed(c.name, "expense");
            const entry = findEntry(c.name, "expense");
            return (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-md border">
                <Checkbox
                  checked={confirmed}
                  disabled={!canEdit}
                  onCheckedChange={(v) => {
                    if (v && !confirmed) confirmExpense.mutate(c);
                    else if (!v && confirmed && entry) unconfirm.mutate(entry.id);
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.category ?? "—"} {c.due_day ? `· vence dia ${c.due_day}` : ""} {c.recurrence === "annual" ? "· anual" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-red-600">{fmtBRL(monthly)}</p>
                  {confirmed && <Badge variant="secondary" className="mt-1"><CheckCircle2 className="h-3 w-3 mr-1" />Pago</Badge>}
                </div>
              </div>
            );
          })}
          {fixed.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum custo fixo cadastrado</p>}
        </div>
      </Card>
      </div>
    </div>
  );
}

function Relatorios() {
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
