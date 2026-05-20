import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_app/cadastros")({ component: CadastrosPage });

type Field = { name: string; label: string; type?: "text" | "textarea" | "number" | "color" | "email"; required?: boolean };

const TABLES: { key: string; label: string; fields: Field[]; orderBy?: string }[] = [
  {
    key: "media_types", label: "Tipos de mídia",
    fields: [
      { name: "name", label: "Nome", required: true },
      { name: "description", label: "Descrição", type: "textarea" },
      { name: "sort_order", label: "Ordem", type: "number" },
    ],
    orderBy: "sort_order",
  },
  {
    key: "workflow_statuses", label: "Etapas do fluxo",
    fields: [
      { name: "name", label: "Nome", required: true },
      { name: "color", label: "Cor", type: "color" },
      { name: "sort_order", label: "Ordem", type: "number" },
    ],
    orderBy: "sort_order",
  },
  {
    key: "priorities", label: "Prioridades",
    fields: [
      { name: "name", label: "Nome", required: true },
      { name: "level", label: "Nível (1-5)", type: "number" },
      { name: "color", label: "Cor", type: "color" },
    ],
    orderBy: "level",
  },
  {
    key: "project_roles", label: "Funções",
    fields: [
      { name: "name", label: "Função", required: true },
      { name: "description", label: "Descrição", type: "textarea" },
    ],
    orderBy: "name",
  },
  {
    key: "collaborator_functions", label: "Subfunções (visibilidade)",
    fields: [
      { name: "name", label: "Nome da função", required: true },
      { name: "key", label: "Chave (slug, ex: editor)", required: true },
      { name: "sort_order", label: "Ordem", type: "number" },
    ],
    orderBy: "sort_order",
  },
  {
    key: "text_snippets", label: "Textos prontos",
    fields: [
      { name: "title", label: "Título", required: true },
      { name: "content", label: "Conteúdo", type: "textarea", required: true },
    ],
    orderBy: "title",
  },
];

function CadastrosPage() {
  const { isManager } = useAuth();
  const [tab, setTab] = useState(TABLES[0].key);

  if (!isManager) {
    return (
      <div className="p-4 md:p-8">
        <p className="text-muted-foreground">Apenas administradores e gerentes podem gerenciar cadastros.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Cadastros</h1>
        <p className="text-muted-foreground mt-1">Configure os dados base usados pelas demandas.</p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          {TABLES.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
        </TabsList>
        {TABLES.map((t) => (
          <TabsContent key={t.key} value={t.key} className="mt-4">
            <CrudTable table={t} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}


function CrudTable({ table }: { table: typeof TABLES[number] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: [table.key],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = (supabase.from as any)(table.key).select("*");
      if (table.orderBy) q.order(table.orderBy, { ascending: true });
      const { data, error } = await q;
      if (error) throw error;
      return data as Record<string, unknown>[];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tbl = (supabase.from as any)(table.key);
      if (editing?.id) {
        const { error } = await tbl.update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await tbl.insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table.key] });
      toast.success("Salvo");
      setOpen(false); setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)(table.key).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [table.key] }); toast.success("Removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const primaryField = table.fields[0].name;
  const secondaryField = table.fields[1]?.name;

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-muted-foreground">{rows.length} registro(s)</span>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} {table.label.slice(0, -1)}</DialogTitle></DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const payload: Record<string, unknown> = {};
                for (const f of table.fields) {
                  const v = fd.get(f.name);
                  if (f.type === "number") payload[f.name] = v ? Number(v) : 0;
                  else payload[f.name] = v ? String(v) : null;
                }
                save.mutate(payload);
              }}
            >
              {table.fields.map((f) => {
                const val = editing?.[f.name];
                if (f.type === "textarea") {
                  return (
                    <div key={f.name} className="space-y-1">
                      <Label htmlFor={f.name}>{f.label}{f.required && " *"}</Label>
                      <Textarea id={f.name} name={f.name} required={f.required} defaultValue={(val as string) ?? ""} rows={3} />
                    </div>
                  );
                }
                return (
                  <div key={f.name} className="space-y-1">
                    <Label htmlFor={f.name}>{f.label}{f.required && " *"}</Label>
                    <Input id={f.name} name={f.name} type={f.type ?? "text"} required={f.required}
                      defaultValue={val !== null && val !== undefined ? String(val) : (f.type === "color" ? "#64748b" : "")} />
                  </div>
                );
              })}
              <DialogFooter>
                <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md divide-y">
        {rows.length === 0 && <p className="p-4 md:p-8 text-center text-sm text-muted-foreground">Nenhum registro</p>}
        {rows.map((r) => (
          <div key={String(r.id)} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40">
            {"color" in r && r.color ? (
              <span className="h-4 w-4 rounded-full border shrink-0" style={{ background: String(r.color) }} />
            ) : null}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{r[primaryField] != null ? String(r[primaryField]) : "—"}</p>
              {secondaryField && r[secondaryField] != null && (
                <p className="text-xs text-muted-foreground truncate">{String(r[secondaryField])}</p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setOpen(true); }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
              onClick={() => { if (confirm("Remover?")) remove.mutate(String(r.id)); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
