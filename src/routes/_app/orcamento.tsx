import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/orcamento")({ component: OrcamentoPage });

const fmtBRL = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Pro = { user_id: string; name: string; hourly_cost: number; hours: number };

function OrcamentoPage() {
  const qc = useQueryClient();
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-budget"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, hourly_cost").order("full_name")).data ?? [],
  });
  const { data: settings } = useQuery({
    queryKey: ["financial_settings"],
    queryFn: async () => (await supabase.from("financial_settings").select("*").eq("id", true).maybeSingle()).data,
  });
  const { data: fixed = [] } = useQuery({
    queryKey: ["fixed_costs_active"],
    queryFn: async () => (await supabase.from("fixed_costs").select("*").eq("active", true)).data ?? [],
  });

  const fixedMonthly = useMemo(
    () => fixed.reduce((s: number, c: any) => s + (c.recurrence === "annual" ? Number(c.amount) / 12 : Number(c.amount)), 0),
    [fixed],
  );

  const [name, setName] = useState("");
  const [hours, setHours] = useState(40);
  const [fixedTotal, setFixedTotal] = useState(0);
  const [profitPct, setProfitPct] = useState(30);
  const [taxPct, setTaxPct] = useState(6);
  const [pros, setPros] = useState<Pro[]>([]);

  useEffect(() => { setFixedTotal(Math.round(fixedMonthly * 100) / 100); }, [fixedMonthly]);
  useEffect(() => { if (settings) setTaxPct(Number(settings.tax_pct ?? 6)); }, [settings]);

  const calc = useMemo(() => {
    const proCost = pros.reduce((s, p) => s + p.hourly_cost * p.hours, 0);
    const proHours = pros.reduce((s, p) => s + p.hours, 0) || hours || 1;
    // proporção de custo fixo aplicada às horas do projeto (assumindo 160h úteis no mês)
    const fixedShare = (fixedTotal / 160) * (proHours);
    const baseCost = proCost + fixedShare;
    const operationHourly = baseCost / proHours;
    const withProfit = baseCost * (1 + profitPct / 100);
    const suggested = withProfit / (1 - taxPct / 100);
    const margin = suggested - withProfit; // imposto
    const liquid = withProfit - baseCost;
    return { proCost, fixedShare, baseCost, operationHourly, suggested, taxAmount: margin, liquid, proHours };
  }, [pros, hours, fixedTotal, profitPct, taxPct]);

  const addPro = () => {
    const remaining = profiles.find((p: any) => !pros.some((x) => x.user_id === p.id));
    if (!remaining) return;
    setPros([...pros, { user_id: remaining.id, name: remaining.full_name, hourly_cost: Number(remaining.hourly_cost ?? 0), hours: 0 }]);
  };

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("budget_simulations").insert({
        name: name || `Simulação ${new Date().toLocaleDateString("pt-BR")}`,
        hours, fixed_cost_total: fixedTotal,
        professionals: pros as any, profit_pct: profitPct, tax_pct: taxPct,
        total_cost: calc.baseCost, suggested_price: calc.suggested,
        created_by: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budget_sims"] }); toast.success("Simulação salva"); },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: sims = [] } = useQuery({
    queryKey: ["budget_sims"],
    queryFn: async () => (await supabase.from("budget_simulations").select("*").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orçamento</h1>
        <p className="text-sm text-muted-foreground">Calcule o preço sugerido com base em custos, profissionais, lucro e imposto.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2 space-y-4">
          <div><Label>Nome da simulação</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Campanha XPTO" /></div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label>Horas do projeto</Label><Input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} /></div>
            <div><Label>Custos fixos /mês</Label><Input type="number" step="0.01" value={fixedTotal} onChange={(e) => setFixedTotal(Number(e.target.value))} /></div>
            <div><Label>Lucro (%)</Label><Input type="number" step="0.1" value={profitPct} onChange={(e) => setProfitPct(Number(e.target.value))} /></div>
            <div><Label>Imposto (%)</Label><Input type="number" step="0.1" value={taxPct} onChange={(e) => setTaxPct(Number(e.target.value))} /></div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>Profissionais</Label>
              <Button size="sm" variant="outline" onClick={addPro}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Profissional</TableHead><TableHead>Custo/hora</TableHead><TableHead>Horas</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {pros.map((p, idx) => (
                  <TableRow key={p.user_id}>
                    <TableCell>
                      <Select value={p.user_id} onValueChange={(v) => {
                        const prof = profiles.find((x: any) => x.id === v);
                        setPros(pros.map((x, i) => i === idx ? { ...x, user_id: v, name: prof?.full_name ?? "", hourly_cost: Number(prof?.hourly_cost ?? 0) } : x));
                      }}>
                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>{profiles.map((pr: any) => <SelectItem key={pr.id} value={pr.id}>{pr.full_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input className="w-28" type="number" step="0.01" value={p.hourly_cost} onChange={(e) => setPros(pros.map((x, i) => i === idx ? { ...x, hourly_cost: Number(e.target.value) } : x))} /></TableCell>
                    <TableCell><Input className="w-24" type="number" step="0.5" value={p.hours} onChange={(e) => setPros(pros.map((x, i) => i === idx ? { ...x, hours: Number(e.target.value) } : x))} /></TableCell>
                    <TableCell className="text-right">{fmtBRL(p.hourly_cost * p.hours)}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => setPros(pros.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
                {pros.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Adicione profissionais para calcular o custo de mão de obra</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="font-medium">Resultado</h3>
          <Row label="Custo profissionais" value={fmtBRL(calc.proCost)} />
          <Row label="Rateio custos fixos" value={fmtBRL(calc.fixedShare)} />
          <Row label="Custo total" value={fmtBRL(calc.baseCost)} bold />
          <Row label="Custo / hora operação" value={fmtBRL(calc.operationHourly)} />
          <hr />
          <Row label={`Lucro (${profitPct}%)`} value={fmtBRL(calc.liquid)} />
          <Row label={`Imposto (${taxPct}%)`} value={fmtBRL(calc.taxAmount)} />
          <hr />
          <Row label="Preço sugerido" value={fmtBRL(calc.suggested)} bold large />
          <Button className="w-full" onClick={() => save.mutate()}><Save className="h-4 w-4 mr-2" />Salvar simulação</Button>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-medium mb-4">Simulações salvas</h3>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Data</TableHead><TableHead>Horas</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Sugerido</TableHead></TableRow></TableHeader>
          <TableBody>
            {sims.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{new Date(s.created_at).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>{s.hours}</TableCell>
                <TableCell className="text-right">{fmtBRL(Number(s.total_cost))}</TableCell>
                <TableCell className="text-right font-semibold">{fmtBRL(Number(s.suggested_price))}</TableCell>
              </TableRow>
            ))}
            {sims.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma simulação salva</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Row({ label, value, bold, large }: { label: string; value: string; bold?: boolean; large?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
      <span className={`${bold ? "font-semibold" : ""} ${large ? "text-xl text-primary" : ""}`}>{value}</span>
    </div>
  );
}
