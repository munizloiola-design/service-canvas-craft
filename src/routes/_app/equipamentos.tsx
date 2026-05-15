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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/equipamentos")({ component: EquipamentosPage });

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function yearsBetween(d: string) {
  const start = new Date(d).getTime();
  const now = Date.now();
  return Math.max(0, (now - start) / (1000 * 60 * 60 * 24 * 365.25));
}
function depreciatedValue(value: number, pctYear: number, dateStr: string) {
  const y = yearsBetween(dateStr);
  return Math.max(0, value * Math.pow(1 - pctYear / 100, y));
}
function monthlyDepreciation(value: number, pctYear: number) {
  return (value * (pctYear / 100)) / 12;
}

type Eq = {
  id: string; code: string; name: string; type: string | null;
  acquisition_value: number; acquisition_date: string;
  depreciation_pct_year: number; notes: string | null; active: boolean;
};

function EquipamentosPage() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("gerente");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Eq | null>(null);
  const [filter, setFilter] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["equipments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipments").select("*").order("name");
      if (error) throw error;
      return data as Eq[];
    },
  });

  const filtered = useMemo(
    () => items.filter((i) => !filter || (i.name + i.code + (i.type ?? "")).toLowerCase().includes(filter.toLowerCase())),
    [items, filter],
  );

  const totals = useMemo(() => {
    const value = items.reduce((s, i) => s + Number(i.acquisition_value || 0), 0);
    const current = items.reduce((s, i) => s + depreciatedValue(Number(i.acquisition_value), Number(i.depreciation_pct_year), i.acquisition_date), 0);
    const monthly = items.reduce((s, i) => s + monthlyDepreciation(Number(i.acquisition_value), Number(i.depreciation_pct_year)), 0);
    return { value, current, monthly, count: items.length };
  }, [items]);

  const save = useMutation({
    mutationFn: async (form: Partial<Eq>) => {
      if (editing) {
        const { error } = await supabase.from("equipments").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("equipments").insert(form as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["equipments"] }); setOpen(false); setEditing(null); toast.success("Salvo"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["equipments"] }); toast.success("Removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Equipamentos</h1>
          <p className="text-sm text-muted-foreground">Cadastro, valor atual e depreciação.</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo equipamento</Button></DialogTrigger>
            <EquipForm editing={editing} onSubmit={(f) => save.mutate(f)} />
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard label="Itens" value={String(totals.count)} />
        <SummaryCard label="Valor de aquisição" value={fmtBRL(totals.value)} />
        <SummaryCard label="Valor atual" value={fmtBRL(totals.current)} />
        <SummaryCard label="Depreciação / mês" value={fmtBRL(totals.monthly)} />
      </div>

      <Card className="p-4">
        <Input placeholder="Filtrar por nome, código ou tipo..." value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-md mb-4" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Tempo de uso</TableHead>
              <TableHead className="text-right">% a.a.</TableHead>
              <TableHead className="text-right">Valor atual</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((i) => {
              const years = yearsBetween(i.acquisition_date);
              return (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.code}</TableCell>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell>{i.type ?? "—"}</TableCell>
                  <TableCell className="text-right">{fmtBRL(Number(i.acquisition_value))}</TableCell>
                  <TableCell>{years.toFixed(1)} anos</TableCell>
                  <TableCell className="text-right">{Number(i.depreciation_pct_year).toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{fmtBRL(depreciatedValue(Number(i.acquisition_value), Number(i.depreciation_pct_year), i.acquisition_date))}</TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(i); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(i.id); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum equipamento cadastrado</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </Card>
  );
}

function EquipForm({ editing, onSubmit }: { editing: Eq | null; onSubmit: (f: any) => void }) {
  const [form, setForm] = useState({
    code: editing?.code ?? `EQ-${Date.now().toString().slice(-6)}`,
    name: editing?.name ?? "",
    type: editing?.type ?? "",
    acquisition_value: editing?.acquisition_value ?? 0,
    acquisition_date: editing?.acquisition_date ?? new Date().toISOString().slice(0, 10),
    depreciation_pct_year: editing?.depreciation_pct_year ?? 20,
    notes: editing?.notes ?? "",
    active: editing?.active ?? true,
  });
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} equipamento</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
          <div><Label>Tipo</Label><Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Câmera, Notebook..." /></div>
        </div>
        <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.acquisition_value} onChange={(e) => setForm({ ...form, acquisition_value: Number(e.target.value) })} /></div>
          <div><Label>Data de aquisição</Label><Input type="date" value={form.acquisition_date} onChange={(e) => setForm({ ...form, acquisition_date: e.target.value })} /></div>
          <div><Label>% Depreciação a.a.</Label><Input type="number" step="0.1" value={form.depreciation_pct_year} onChange={(e) => setForm({ ...form, depreciation_pct_year: Number(e.target.value) })} /></div>
        </div>
        <div><Label>Notas</Label><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(form)}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}
