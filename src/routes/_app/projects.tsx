import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Calendar, User as UserIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/projects")({
  component: ProjectsPage,
});

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Status = Database["public"]["Enums"]["project_status"];
type Priority = Database["public"]["Enums"]["project_priority"];

const COLUMNS: { key: Status; label: string; tone: string }[] = [
  { key: "a_fazer", label: "A fazer", tone: "bg-muted" },
  { key: "em_andamento", label: "Em andamento", tone: "bg-info/10" },
  { key: "em_revisao", label: "Em revisão", tone: "bg-warning/15" },
  { key: "concluido", label: "Concluído", tone: "bg-success/10" },
];

const PRIORITY_STYLES: Record<Priority, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-info/15 text-info",
  alta: "bg-warning/20 text-warning-foreground",
  urgente: "bg-destructive/15 text-destructive",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

function ProjectsPage() {
  const { isManager, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data;
    },
  });

  const memberMap = new Map(members.map((m) => [m.id, m.full_name]));

  const createProject = useMutation({
    mutationFn: async (payload: Database["public"]["Tables"]["projects"]["Insert"]) => {
      const { error } = await supabase.from("projects").insert({ ...payload, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto criado");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("projects").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <header className="mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projetos</h1>
          <p className="text-muted-foreground mt-1">Acompanhe o fluxo de trabalho da equipe.</p>
        </div>
        {isManager && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Novo projeto</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Novo projeto</DialogTitle></DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const assigned = String(fd.get("assigned_to"));
                  createProject.mutate({
                    title: String(fd.get("title")),
                    description: String(fd.get("description")) || null,
                    client_name: String(fd.get("client_name")) || null,
                    due_date: String(fd.get("due_date")) || null,
                    priority: (String(fd.get("priority")) || "media") as Priority,
                    status: "a_fazer",
                    budget: fd.get("budget") ? Number(fd.get("budget")) : null,
                    assigned_to: assigned && assigned !== "none" ? assigned : null,
                  });
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input id="title" name="title" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="client_name">Cliente</Label>
                    <Input id="client_name" name="client_name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Prazo</Label>
                    <Input id="due_date" name="due_date" type="date" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <Select name="priority" defaultValue="media">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                          <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget">Valor (R$)</Label>
                    <Input id="budget" name="budget" type="number" step="0.01" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Select name="assigned_to" defaultValue="none">
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem responsável</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name || "Sem nome"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" name="description" rows={3} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createProject.isPending}>
                    {createProject.isPending ? "Salvando..." : "Criar projeto"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const items = projects.filter((p) => p.status === col.key);
          return (
            <div key={col.key} className="flex flex-col">
              <div className={`rounded-t-lg px-4 py-3 ${col.tone} flex items-center justify-between`}>
                <h3 className="text-sm font-semibold">{col.label}</h3>
                <span className="text-xs text-muted-foreground bg-background/80 rounded px-2 py-0.5">{items.length}</span>
              </div>
              <div className="bg-card border border-t-0 rounded-b-lg p-3 space-y-3 min-h-[300px]">
                {items.map((p) => (
                  <Card key={p.id} className="p-3 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-medium text-sm leading-snug">{p.title}</h4>
                      <Badge className={`${PRIORITY_STYLES[p.priority]} border-0 text-[10px] px-1.5 py-0 shrink-0`}>
                        {PRIORITY_LABELS[p.priority]}
                      </Badge>
                    </div>
                    {p.client_name && (
                      <p className="text-xs text-muted-foreground mb-2">{p.client_name}</p>
                    )}
                    {p.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{p.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground mb-3">
                      {p.due_date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(p.due_date).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      {p.assigned_to && (
                        <span className="inline-flex items-center gap-1">
                          <UserIcon className="h-3 w-3" />
                          {memberMap.get(p.assigned_to) ?? "—"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={p.status}
                        onValueChange={(v) => updateStatus.mutate({ id: p.id, status: v as Status })}
                      >
                        <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COLUMNS.map((c) => (
                            <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isManager && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Remover "${p.title}"?`)) deleteProject.mutate(p.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Vazio</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
