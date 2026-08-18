import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAccess } from "@/lib/access-context";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban, Clock, CheckCircle2, AlertTriangle, Users, DollarSign, TrendingUp, Calendar,
  Plus, X, Pencil, GripVertical, Wrench, Repeat, ArrowUpRight,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, Cell } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, differenceInYears, differenceInSeconds } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/dashboard")({ component: DashboardPage });

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

// Escopo do dashboard: null = toda a equipe (só gestores); caso contrário, id da pessoa.
const DashboardScopeContext = createContext<string | null>(null);
const useScopeUserId = () => useContext(DashboardScopeContext);


// Widget catalog — `menu` é a chave de menu (Perfis e Acessos) exigida para ver o widget.
const WIDGETS = {
  stats_overview: { label: "Indicadores gerais", size: "lg" as const, menu: null },
  cash_flow: { label: "Fluxo de caixa (12 meses)", size: "lg" as const, menu: "/financeiro" },
  projects_by_status: { label: "Projetos por etapa", size: "md" as const, menu: "/projects" },
  status_timer: { label: "Tempo médio por etapa", size: "md" as const, menu: "/tempo" },
  upcoming_deadlines: { label: "Próximos prazos", size: "md" as const, menu: "/projects" },
  overdue_projects: { label: "Demandas atrasadas", size: "md" as const, menu: "/projects" },

  recurring_revenue: { label: "Receitas recorrentes", size: "md" as const, menu: "/financeiro" },
  team_load: { label: "Carga por profissional", size: "md" as const, menu: "/team" },
  equipment_depreciated: { label: "Depreciação de equipamentos", size: "md" as const, menu: "/equipamentos" },
  recent_projects: { label: "Projetos recentes", size: "md" as const, menu: "/projects" },
  my_projects: { label: "Minhas demandas", size: "md" as const, menu: null },
  pending_tickets: { label: "Tickets pendentes", size: "md" as const, menu: "/tickets" },
  pending_approvals: { label: "Aprovações do cliente", size: "md" as const, menu: "/aprovacoes" },
  crm_funnel: { label: "Funil de prospecção", size: "md" as const, menu: "/clientes/crm" },
  finance_requests: { label: "Autorizações financeiras", size: "md" as const, menu: "/financeiro" },
} as const;

type WidgetKey = keyof typeof WIDGETS;
const DEFAULT_WIDGETS: WidgetKey[] = ["stats_overview", "cash_flow", "projects_by_status", "upcoming_deadlines"];


type WidgetRow = { id: string; widget_key: string; position: number; size: string };

function DashboardPage() {
  const { user, isManager } = useAuth();
  const { menuAllowed } = useAccess();
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [scopeUser, setScopeUser] = useState<string>("all");

  const { data: members = [] } = useQuery({
    queryKey: ["dash-members"],
    enabled: !!isManager,
    queryFn: async () => (await supabase.from("internal_profiles").select("id, full_name").order("full_name")).data ?? [],
  });

  // Colaborador só enxerga o próprio escopo.
  const scopeUserId = isManager ? (scopeUser === "all" ? null : scopeUser) : (user?.id ?? null);


  const canSee = (k: WidgetKey) => {
    const m = WIDGETS[k]?.menu;
    return !m || menuAllowed(m);
  };

  const { data: allWidgets = [], isLoading } = useQuery({
    queryKey: ["dashboard_widgets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("dashboard_widgets").select("*").eq("user_id", user!.id).order("position");
      if (error) throw error;
      return data as WidgetRow[];
    },
  });

  // Widgets sem permissão ficam ocultos (não são apagados do banco)
  const widgets = allWidgets.filter((w) => w.widget_key in WIDGETS && canSee(w.widget_key as WidgetKey));

  // Seed defaults on first visit
  useEffect(() => {
    if (!user || isLoading) return;
    if (allWidgets.length === 0) {
      const seeds = DEFAULT_WIDGETS.filter(canSee);
      if (seeds.length === 0) return;
      (async () => {
        await supabase.from("dashboard_widgets").insert(
          seeds.map((k, i) => ({
            user_id: user.id, widget_key: k, position: i, size: WIDGETS[k].size,
          }))
        );
        qc.invalidateQueries({ queryKey: ["dashboard_widgets"] });
      })();
    }
  }, [user, allWidgets, isLoading, qc]);


  const reorder = useMutation({
    mutationFn: async (ordered: WidgetRow[]) => {
      for (let i = 0; i < ordered.length; i++) {
        await supabase.from("dashboard_widgets").update({ position: i }).eq("id", ordered[i].id);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard_widgets"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dashboard_widgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard_widgets"] }),
  });

  const add = useMutation({
    mutationFn: async (key: WidgetKey) => {
      const { error } = await supabase.from("dashboard_widgets").insert({
        user_id: user!.id, widget_key: key, position: widgets.length, size: WIDGETS[key].size,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dashboard_widgets"] }); toast.success("Widget adicionado"); },
  });

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = widgets.findIndex((w) => w.id === active.id);
    const newIdx = widgets.findIndex((w) => w.id === over.id);
    const next = arrayMove(widgets, oldIdx, newIdx);
    qc.setQueryData(["dashboard_widgets", user?.id], next);
    reorder.mutate(next);
  };

  const usedKeys = new Set(allWidgets.map((w) => w.widget_key));
  const available = (Object.keys(WIDGETS) as WidgetKey[]).filter((k) => !usedKeys.has(k) && canSee(k));


  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gradient">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral da operação. Personalize os widgets.</p>
        </div>
        <div className="flex gap-2 items-center">
          {isManager && (
            <Select value={scopeUser} onValueChange={setScopeUser}>
              <SelectTrigger className="w-[220px] h-9">
                <Users className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Toda a equipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda a equipe</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id!} value={m.id!}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {editMode && available.length > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar widget</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Escolher widget</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-2">
                  {available.map((k) => (
                    <Button key={k} variant="outline" className="justify-start h-auto py-3" onClick={() => add.mutate(k)}>
                      {WIDGETS[k].label}
                    </Button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button variant={editMode ? "default" : "outline"} size="sm" onClick={() => setEditMode((v) => !v)}>
            <Pencil className="h-4 w-4 mr-1" /> {editMode ? "Concluir" : "Personalizar"}
          </Button>
        </div>
      </header>

      <DashboardScopeContext.Provider value={scopeUserId}>
        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {widgets.map((w) => (
                <SortableWidget key={w.id} widget={w} editMode={editMode}
                  onRemove={() => remove.mutate(w.id)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </DashboardScopeContext.Provider>


      {widgets.length === 0 && !isLoading && (
        <Card className="p-12 text-center text-muted-foreground">Carregando widgets padrão...</Card>
      )}
    </div>
  );
}

function SortableWidget({ widget, editMode, onRemove }: { widget: WidgetRow; editMode: boolean; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const isLg = WIDGETS[widget.widget_key as WidgetKey]?.size === "lg";

  return (
    <div ref={setNodeRef} style={style} className={isLg ? "lg:col-span-2" : ""}>
      <Card className="p-5 relative">
        {editMode && (
          <div className="absolute top-2 right-2 flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-grab" {...attributes} {...listeners}>
              <GripVertical className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={onRemove}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <WidgetRenderer widgetKey={widget.widget_key as WidgetKey} />
      </Card>
    </div>
  );
}

function WidgetRenderer({ widgetKey }: { widgetKey: WidgetKey }) {
  switch (widgetKey) {
    case "my_projects": return <MyProjects />;
    case "pending_tickets": return <PendingTickets />;
    case "pending_approvals": return <PendingApprovals />;
    case "crm_funnel": return <CrmFunnel />;
    case "finance_requests": return <FinanceRequests />;

    case "stats_overview": return <StatsOverview />;
    case "cash_flow": return <CashFlow />;
    case "projects_by_status": return <ProjectsByStatus />;
    case "status_timer": return <StatusTimer />;
    case "upcoming_deadlines": return <UpcomingDeadlines />;
    case "overdue_projects": return <OverdueProjects />;

    case "recurring_revenue": return <RecurringRevenue />;
    case "team_load": return <TeamLoad />;
    case "equipment_depreciated": return <EquipmentDepreciated />;
    case "recent_projects": return <RecentProjects />;
  }
}

// ========== Widgets ==========

type QuickFilter = "abertas" | "concluidas" | "urgentes" | "atrasadas";

// Demandas do escopo atual (null = toda a equipe, só para gestores).
function useVisibleProjects<T extends { id: string; assigned_to?: string | null }>(rows: T[]) {
  const scopeUserId = useScopeUserId();
  const { data: assignees = [] } = useQuery({
    queryKey: ["project_assignees_dash"],
    queryFn: async () => (await supabase.from("project_assignees").select("project_id, user_id")).data ?? [],
  });
  return useMemo(() => {
    if (!scopeUserId) return rows;
    const mine = new Set(assignees.filter((a) => a.user_id === scopeUserId).map((a) => a.project_id));
    return rows.filter((p) => p.assigned_to === scopeUserId || mine.has(p.id));
  }, [rows, assignees, scopeUserId]);
}


function StatsOverview() {
  const { menuAllowed } = useAccess();
  const [openStat, setOpenStat] = useState<string | null>(null);
  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects-stats"],
    queryFn: async () => (await supabase.from("projects").select("id, title, status_id, priority_id, due_date, assigned_to, client_id, team_id")).data ?? [],
  });
  const projects = useVisibleProjects(allProjects);
  const { data: statuses = [] } = useQuery({
    queryKey: ["workflow_statuses"],
    queryFn: async () => (await supabase.from("workflow_statuses").select("id, name, is_final, color")).data ?? [],
  });
  const { data: priorities = [] } = useQuery({
    queryKey: ["priorities"],
    queryFn: async () => (await supabase.from("priorities").select("id, name, level")).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("id, name")).data ?? [],
  });

  const stageRules = useStageRules();
  const urgentId = [...priorities].sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0]?.id;
  const today = format(new Date(), "yyyy-MM-dd");
  const isDone = (p: { status_id: string | null }) => stageRules.isDone(p.status_id);
  const total = projects.length;
  const done = projects.filter(isDone).length;
  const open = total - done;
  const urgent = projects.filter((p) => p.priority_id === urgentId && !isDone(p)).length;
  const overdue = projects.filter((p) => !isDone(p) && p.due_date && p.due_date < today).length;

  const canProjects = menuAllowed("/projects");
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);
  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const priorityLevel = useMemo(() => new Map(priorities.map((p) => [p.id, p.level ?? 0])), [priorities]);

  type StatItem = {
    label: string;
    value: number;
    icon: typeof Clock;
    color: string;
    quick?: QuickFilter;
    filter: (p: (typeof projects)[number]) => boolean;
  };

  const stats: StatItem[] = [
    { label: "Total", value: total, icon: FolderKanban, color: "text-info", filter: () => true },
    { label: "Em aberto", value: open, icon: Clock, color: "text-warning", quick: "abertas", filter: (p) => !isDone(p) },
    { label: "Concluídos", value: done, icon: CheckCircle2, color: "text-success", quick: "concluidas", filter: (p) => isDone(p) },
    { label: "Urgentes", value: urgent, icon: AlertTriangle, color: "text-destructive", quick: "urgentes", filter: (p) => p.priority_id === urgentId && !isDone(p) },
    { label: "Atrasados", value: overdue, icon: AlertTriangle, color: "text-destructive", quick: "atrasadas", filter: (p) => !isDone(p) && !!p.due_date && p.due_date < today },
  ];

  const selected = stats.find((s) => s.label === openStat);
  const selectedProjects = useMemo(() => {
    if (!selected) return [];
    return projects
      .filter(selected.filter)
      .sort((a, b) => {
        const pa = priorityLevel.get(a.priority_id ?? "") ?? 0;
        const pb = priorityLevel.get(b.priority_id ?? "") ?? 0;
        if (pb !== pa) return pb - pa;
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
  }, [selected, projects, priorityLevel]);

  return (
    <div>
      <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Indicadores gerais</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          const inner = (
            <>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase text-muted-foreground">{s.label}</span>
                <Icon className={`h-3.5 w-3.5 ${s.color}`} />
              </div>
              <p className="text-2xl font-semibold">{s.value}</p>
            </>
          );
          if (!canProjects) {
            return <div key={s.label} className="bg-muted/40 rounded-md p-3">{inner}</div>;
          }
          return (
            <button
              key={s.label}
              onClick={() => setOpenStat(s.label)}
              className="group bg-muted/40 rounded-md p-3 text-left transition-all hover:bg-muted hover:shadow-sm hover:-translate-y-0.5 relative"
            >
              {inner}
              <ArrowUpRight className="h-3 w-3 absolute bottom-2 right-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          );
        })}
      </div>

      <Dialog open={!!openStat} onOpenChange={(o) => !o && setOpenStat(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 shrink-0 border-b">
            <DialogTitle className="text-lg">
              {selected?.label} — {selected?.value} {selected?.value === 1 ? "demanda" : "demandas"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {selectedProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma demanda neste indicador.</p>
            ) : (
              <div className="divide-y">
                {selectedProjects.map((p) => {
                  const status = p.status_id ? statusMap.get(p.status_id) : null;
                  const isLate = !isDone(p) && !!p.due_date && p.due_date < today;
                  return (
                    <Link
                      key={p.id}
                      to="/projects"
                      search={{ detail: p.id, quick: undefined }}
                      onClick={() => setOpenStat(null)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 hover:bg-muted/30 -mx-1 px-1 rounded"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {p.client_id ? (clientMap.get(p.client_id) ?? "—") : "—"}
                          {status && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
                              {status.name}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {p.due_date && (
                          <span className={`text-xs ${isLate ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            {format(new Date(p.due_date), "dd/MM/yyyy")}
                          </span>
                        )}
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-6 py-4 shrink-0 border-t flex justify-end">
            <Button asChild variant="default" size="sm">
              <Link
                to="/projects"
                search={{ detail: undefined, quick: selected?.quick }}
                onClick={() => setOpenStat(null)}
              >
                Acesse as demandas
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OverdueProjects() {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: statuses = [] } = useQuery({
    queryKey: ["workflow_statuses"],
    queryFn: async () => (await supabase.from("workflow_statuses").select("id, name, is_final")).data ?? [],
  });
  const { data: rows = [] } = useQuery({
    queryKey: ["overdue-projects", today],
    queryFn: async () => (await supabase.from("projects")
      .select("id, title, due_date, client_id, status_id, assigned_to")
      .lt("due_date", today)
      .order("due_date")).data ?? [],
  });
  const visible = useVisibleProjects(rows);
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("id, name")).data ?? [],
  });
  const cmap = new Map(clients.map((c) => [c.id, c.name]));

  const stageRules = useStageRules();
  const overdue = visible.filter((p) => !stageRules.isDone(p.status_id));
  const shown = overdue.slice(0, 8);

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" /> Demandas atrasadas
      </h3>
      {overdue.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma demanda atrasada.</p>}
      <div className="divide-y">
        {shown.map((p) => {
          const days = Math.max(1, Math.round(differenceInSeconds(new Date(today), new Date(p.due_date!)) / 86400));
          return (
            <Link key={p.id} to="/projects" search={{ detail: p.id, quick: undefined }} className="flex items-center justify-between py-2 hover:bg-muted/30 -mx-1 px-1 rounded">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.client_id ? cmap.get(p.client_id) : "—"} · {format(new Date(p.due_date!), "dd/MM")}
                </p>
              </div>
              <Badge variant="destructive" className="ml-2 text-xs shrink-0">{days}d</Badge>
            </Link>
          );
        })}
      </div>
      {overdue.length > shown.length && (
        <Link to="/projects" search={{ detail: undefined, quick: "atrasadas" }} className="block mt-3 text-xs text-primary hover:underline">
          Ver todas ({overdue.length})
        </Link>
      )}
    </div>
  );
}


function CashFlow() {
  const { data: entries = [] } = useQuery({
    queryKey: ["fe-12m"],
    queryFn: async () => (await supabase.from("financial_entries").select("kind, amount, entry_date")
      .gte("entry_date", format(subMonths(startOfMonth(new Date()), 11), "yyyy-MM-dd"))).data ?? [],
  });

  const months = useMemo(() => {
    const arr: { month: string; entradas: number; saidas: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      arr.push({ month: format(d, "MMM", { locale: ptBR }), entradas: 0, saidas: 0 });
    }
    for (const e of entries) {
      const idx = 11 - Math.round(differenceInSeconds(startOfMonth(new Date()), startOfMonth(new Date(e.entry_date))) / (60 * 60 * 24 * 30.44));
      if (idx >= 0 && idx < 12) {
        if (e.kind === "income") arr[idx].entradas += Number(e.amount);
        else arr[idx].saidas += Number(e.amount);
      }
    }
    return arr;
  }, [entries]);

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Fluxo de caixa — 12 meses</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={months}>
            <XAxis dataKey="month" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Line type="monotone" dataKey="entradas" stroke="var(--chart-1)" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="saidas" stroke="var(--chart-3)" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ProjectsByStatus() {
  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects-by-status"],
    queryFn: async () => (await supabase.from("projects").select("id, status_id, assigned_to")).data ?? [],
  });
  const projects = useVisibleProjects(allProjects);

  const { data: statuses = [] } = useQuery({
    queryKey: ["workflow_statuses"],
    queryFn: async () => (await supabase.from("workflow_statuses").select("id, name, color, sort_order").order("sort_order")).data ?? [],
  });

  const data = statuses.map((s) => ({
    name: s.name, count: projects.filter((p) => p.status_id === s.id).length, color: s.color,
  }));

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><FolderKanban className="h-4 w-4 text-primary" /> Projetos por etapa</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="name" fontSize={10} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis fontSize={10} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count">{data.map((d, i) => <Cell key={i} fill={d.color} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatusTimer() {
  const { data: transitions = [] } = useQuery({
    queryKey: ["transitions-all"],
    queryFn: async () => (await supabase.from("project_transitions")
      .select("project_id, from_status_id, to_status_id, created_at").order("created_at")).data ?? [],
  });
  const { data: statuses = [] } = useQuery({
    queryKey: ["workflow_statuses"],
    queryFn: async () => (await supabase.from("workflow_statuses").select("id, name, color")).data ?? [],
  });

  const avgs = useMemo(() => {
    const totals = new Map<string, { sum: number; count: number }>();
    const byProject = new Map<string, typeof transitions>();
    for (const t of transitions) {
      if (!byProject.has(t.project_id)) byProject.set(t.project_id, []);
      byProject.get(t.project_id)!.push(t);
    }
    for (const list of byProject.values()) {
      for (let i = 1; i < list.length; i++) {
        const from = list[i].from_status_id;
        if (!from) continue;
        const dur = differenceInSeconds(new Date(list[i].created_at), new Date(list[i - 1].created_at));
        const cur = totals.get(from) ?? { sum: 0, count: 0 };
        totals.set(from, { sum: cur.sum + dur, count: cur.count + 1 });
      }
    }
    return statuses.map((s) => {
      const t = totals.get(s.id);
      return { name: s.name, color: s.color, avgHours: t ? Math.round(t.sum / t.count / 3600) : 0, count: t?.count ?? 0 };
    });
  }, [transitions, statuses]);

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Tempo médio por etapa</h3>
      <div className="space-y-2">
        {avgs.length === 0 && <p className="text-xs text-muted-foreground">Sem transições registradas ainda.</p>}
        {avgs.map((a) => (
          <div key={a.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
              <span>{a.name}</span>
            </div>
            <span className="text-muted-foreground text-xs">
              {a.count > 0 ? `${a.avgHours}h (${a.count}x)` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UpcomingDeadlines() {
  const { data: allProjects = [] } = useQuery({
    queryKey: ["upcoming"],
    queryFn: async () => (await supabase.from("projects")
      .select("id, title, due_date, client_id, status_id, assigned_to")
      .gte("due_date", format(new Date(), "yyyy-MM-dd"))
      .order("due_date").limit(60)).data ?? [],
  });
  const projects = useVisibleProjects(allProjects).slice(0, 8);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("id, name")).data ?? [],
  });
  const cmap = new Map(clients.map((c) => [c.id, c.name]));

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Próximos prazos</h3>
      {projects.length === 0 && <p className="text-xs text-muted-foreground">Nenhum prazo futuro.</p>}
      <div className="divide-y">
        {projects.map((p) => (
          <Link key={p.id} to="/projects" search={{ detail: p.id }} className="flex items-center justify-between py-2 hover:bg-muted/30 -mx-1 px-1 rounded">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{p.title}</p>
              <p className="text-xs text-muted-foreground truncate">{p.client_id ? cmap.get(p.client_id) : "—"}</p>
            </div>
            <Badge variant="outline" className="ml-2 text-xs">
              {format(new Date(p.due_date!), "dd/MM")}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}

function RecurringRevenue() {
  const { data: rows = [] } = useQuery({
    queryKey: ["ri-active"],
    queryFn: async () => (await supabase.from("recurring_incomes").select("description, amount, recurrence").eq("active", true)).data ?? [],
  });
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Repeat className="h-4 w-4 text-primary" /> Receitas recorrentes</h3>
      <p className="text-2xl font-semibold mb-3">{fmt(total)} <span className="text-xs text-muted-foreground font-normal">/ mês</span></p>
      <div className="space-y-1.5 text-sm max-h-32 overflow-auto">
        {rows.map((r, i) => (
          <div key={i} className="flex justify-between"><span className="truncate">{r.description}</span><span className="text-muted-foreground ml-2">{fmt(Number(r.amount))}</span></div>
        ))}
        {rows.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma receita recorrente.</p>}
      </div>
    </div>
  );
}

function TeamLoad() {
  const { data: assignees = [] } = useQuery({
    queryKey: ["pa-load"],
    queryFn: async () => (await supabase.from("project_assignees").select("user_id, project_id")).data ?? [],
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["proj-status"],
    queryFn: async () => (await supabase.from("projects").select("id, status_id")).data ?? [],
  });
  const { data: statuses = [] } = useQuery({
    queryKey: ["workflow_statuses"],
    queryFn: async () => (await supabase.from("workflow_statuses").select("id, is_final")).data ?? [],
  });
  const { data: members = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => (await supabase.from("internal_profiles").select("id, full_name")).data ?? [],
  });

  const scopeUserId = useScopeUserId();
  const stageRules = useStageRules();
  const openProjectIds = new Set(projects.filter((p) => !stageRules.isDone(p.status_id)).map((p) => p.id));
  const counts = new Map<string, number>();
  for (const a of assignees) {
    if (openProjectIds.has(a.project_id)) counts.set(a.user_id, (counts.get(a.user_id) ?? 0) + 1);
  }
  const list = members.map((m) => ({ id: m.id, name: m.full_name, count: counts.get(m.id ?? "") ?? 0 }))
    .filter((m) => m.count > 0).sort((a, b) => b.count - a.count).slice(0, 6);

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Carga por profissional</h3>
      {list.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum responsável atribuído.</p> : (
        <div className="space-y-2">
          {list.map((m) => {
            const active = !!scopeUserId && m.id === scopeUserId;
            return (
              <div key={m.name} className={`flex items-center gap-2 text-sm rounded px-1 ${active ? "bg-primary/10 font-medium" : ""}`}>
                <span className="flex-1 truncate">{m.name}</span>
                <div className={`h-2 rounded-full ${active ? "bg-primary" : "bg-primary/15"}`} style={{ width: `${m.count * 14}px`, maxWidth: "60%" }} />
                <span className="text-xs text-muted-foreground w-6 text-right">{m.count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>

  );
}

function EquipmentDepreciated() {
  const { data: eq = [] } = useQuery({
    queryKey: ["equipments-active"],
    queryFn: async () => (await supabase.from("equipments").select("name, acquisition_value, acquisition_date, depreciation_pct_year").eq("active", true)).data ?? [],
  });
  const items = eq.map((e) => {
    const years = differenceInYears(new Date(), new Date(e.acquisition_date));
    const current = Number(e.acquisition_value) * Math.pow(1 - Number(e.depreciation_pct_year) / 100, Math.max(0, years));
    return { name: e.name, original: Number(e.acquisition_value), current };
  });
  const totalOriginal = items.reduce((s, i) => s + i.original, 0);
  const totalCurrent = items.reduce((s, i) => s + i.current, 0);

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Wrench className="h-4 w-4 text-primary" /> Equipamentos</h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-muted/40 rounded p-2"><p className="text-[10px] text-muted-foreground uppercase">Aquisição</p><p className="text-lg font-semibold">{fmt(totalOriginal)}</p></div>
        <div className="bg-muted/40 rounded p-2"><p className="text-[10px] text-muted-foreground uppercase">Valor atual</p><p className="text-lg font-semibold">{fmt(totalCurrent)}</p></div>
      </div>
      <p className="text-xs text-muted-foreground">{items.length} equipamento(s) ativo(s) · Depreciação total: {fmt(totalOriginal - totalCurrent)}</p>
    </div>
  );
}

function RecentProjects() {
  const { data: allProjects = [] } = useQuery({
    queryKey: ["recent-projects"],
    queryFn: async () => (await supabase.from("projects").select("id, title, client_id, due_date, status_id, assigned_to").order("created_at", { ascending: false }).limit(60)).data ?? [],
  });
  const projects = useVisibleProjects(allProjects).slice(0, 5);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("id, name")).data ?? [],
  });
  const { data: statuses = [] } = useQuery({
    queryKey: ["workflow_statuses"],
    queryFn: async () => (await supabase.from("workflow_statuses").select("id, name, color")).data ?? [],
  });
  const cmap = new Map(clients.map((c) => [c.id, c.name]));
  const smap = new Map(statuses.map((s) => [s.id, s]));

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> Projetos recentes</h3>
      <div className="divide-y">
        {projects.map((p) => {
          const st = p.status_id ? smap.get(p.status_id) : null;
          return (
            <div key={p.id} className="py-2 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground truncate">{p.client_id ? cmap.get(p.client_id) : "—"}</p>
              </div>
              {st && <Badge className="border-0 text-xs" style={{ background: `${st.color}25`, color: st.color }}>{st.name}</Badge>}
            </div>
          );
        })}
        {projects.length === 0 && <p className="text-xs text-muted-foreground py-3 text-center">Nenhum projeto.</p>}
      </div>
    </div>
  );
}

function MyProjects() {
  const { user } = useAuth();
  const { data: mine = [] } = useQuery({
    queryKey: ["my-projects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: pa } = await supabase.from("project_assignees").select("project_id").eq("user_id", user!.id);
      const ids = (pa ?? []).map((r) => r.project_id);
      const { data } = await supabase
        .from("projects")
        .select("id, title, due_date, status_id, assigned_to")
        .order("due_date", { ascending: true })
        .limit(50);
      return (data ?? []).filter((p) => p.assigned_to === user!.id || ids.includes(p.id)).slice(0, 6);
    },
  });
  const { data: statuses = [] } = useQuery({
    queryKey: ["workflow_statuses"],
    queryFn: async () => (await supabase.from("workflow_statuses").select("id, name, color, is_final")).data ?? [],
  });
  const stageRulesMine = useStageRules();
  const smap = new Map(statuses.map((s) => [s.id, s]));
  const open = mine.filter((p) => !stageRulesMine.isDone(p.status_id));

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><FolderKanban className="h-4 w-4 text-primary" /> Minhas demandas</h3>
      {open.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma demanda atribuída a você.</p> : (
        <div className="divide-y">
          {open.map((p) => {
            const st = p.status_id ? smap.get(p.status_id) : null;
            return (
              <Link key={p.id} to="/projects" search={{ detail: p.id }} className="py-2 flex items-center justify-between gap-2 hover:bg-muted/40 rounded px-1">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.due_date ? format(new Date(p.due_date + "T00:00:00"), "dd MMM", { locale: ptBR }) : "sem prazo"}
                  </p>
                </div>
                {st && <Badge className="border-0 text-xs" style={{ background: `${st.color}25`, color: st.color }}>{st.name}</Badge>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PendingTickets() {
  const { data: tickets = [] } = useQuery({
    queryKey: ["dash-tickets-pending"],
    queryFn: async () =>
      (await supabase.from("ticket_requests").select("id, title, requester_name, created_at, status").eq("status", "pendente").order("created_at", { ascending: false }).limit(6)).data ?? [],
  });
  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-primary" /> Tickets pendentes</h3>
      {tickets.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum ticket aguardando triagem.</p> : (
        <div className="divide-y">
          {tickets.map((t) => (
            <div key={t.id} className="py-2">
              <p className="text-sm font-medium truncate">{t.title}</p>
              <p className="text-xs text-muted-foreground truncate">{t.requester_name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PendingApprovals() {
  const { data: projects = [] } = useQuery({
    queryKey: ["dash-approvals"],
    queryFn: async () => (await supabase.from("projects").select("id, title, status_id, client_decision").limit(200)).data ?? [],
  });
  const { data: statuses = [] } = useQuery({
    queryKey: ["workflow_statuses"],
    queryFn: async () => (await supabase.from("workflow_statuses").select("id, name, color, is_client_validation")).data ?? [],
  });
  const validation = new Set(statuses.filter((s) => s.is_client_validation).map((s) => s.id));
  const list = projects.filter((p) => p.status_id && validation.has(p.status_id) && !p.client_decision).slice(0, 6);

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Aprovações do cliente</h3>
      {list.length === 0 ? <p className="text-xs text-muted-foreground">Nada aguardando aprovação.</p> : (
        <div className="divide-y">
          {list.map((p) => (
            <div key={p.id} className="py-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{p.title}</p>
              <Badge variant="secondary" className="shrink-0 text-xs">Aguardando</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CrmFunnel() {
  const { data: stages = [] } = useQuery({
    queryKey: ["crm_stages"],
    queryFn: async () => (await supabase.from("crm_stages").select("id, name, color, sort_order").order("sort_order")).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["dash-prospects"],
    queryFn: async () => (await supabase.from("clients").select("id, prospect_stage, prospect_value").eq("status", "prospect")).data ?? [],
  });
  const rows = stages.map((s) => {
    const items = clients.filter((c) => (c.prospect_stage ?? "").trim() === s.name);
    return { name: s.name, color: s.color ?? "#6b7280", count: items.length, value: items.reduce((sum, c) => sum + Number(c.prospect_value ?? 0), 0) };
  });
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Funil de prospecção</h3>
      {rows.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum estágio cadastrado.</p> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate">{r.name}</span>
              <div className="h-2 rounded-full" style={{ width: `${(r.count / max) * 40 + 4}%`, background: `${r.color}55` }} />
              <span className="text-xs text-muted-foreground w-24 text-right">{r.count} · {fmt(r.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FinanceRequests() {
  const { data: reqs = [] } = useQuery({
    queryKey: ["dash-finance-requests"],
    queryFn: async () =>
      (await supabase.from("financial_entry_requests").select("id, description, amount, kind, requester_name, status").eq("status", "pendente").order("created_at", { ascending: false }).limit(6)).data ?? [],
  });
  const total = reqs.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> Autorizações financeiras</h3>
      {reqs.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma solicitação pendente.</p> : (
        <>
          <p className="text-xs text-muted-foreground mb-2">{reqs.length} pendente(s) · {fmt(total)}</p>
          <div className="divide-y">
            {reqs.map((r) => (
              <div key={r.id} className="py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.description}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.requester_name}</p>
                </div>
                <span className={`text-sm shrink-0 ${r.kind === "entrada" ? "text-emerald-600" : "text-destructive"}`}>{fmt(Number(r.amount ?? 0))}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
