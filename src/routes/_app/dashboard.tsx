import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban, Clock, CheckCircle2, AlertTriangle, Users, DollarSign, TrendingUp, Calendar,
  Plus, X, Pencil, GripVertical, Wrench, Repeat,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, Cell } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, differenceInYears, differenceInSeconds } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/dashboard")({ component: DashboardPage });

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

// Widget catalog
const WIDGETS = {
  stats_overview: { label: "Indicadores gerais", size: "lg" as const },
  cash_flow: { label: "Fluxo de caixa (12 meses)", size: "lg" as const },
  projects_by_status: { label: "Projetos por etapa", size: "md" as const },
  status_timer: { label: "Tempo médio por etapa", size: "md" as const },
  upcoming_deadlines: { label: "Próximos prazos", size: "md" as const },
  recurring_revenue: { label: "Receitas recorrentes", size: "md" as const },
  team_load: { label: "Carga por profissional", size: "md" as const },
  equipment_depreciated: { label: "Depreciação de equipamentos", size: "md" as const },
  recent_projects: { label: "Projetos recentes", size: "md" as const },
} as const;

type WidgetKey = keyof typeof WIDGETS;
const DEFAULT_WIDGETS: WidgetKey[] = ["stats_overview", "cash_flow", "projects_by_status", "upcoming_deadlines"];

type WidgetRow = { id: string; widget_key: string; position: number; size: string };

function DashboardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState(false);

  const { data: widgets = [], isLoading } = useQuery({
    queryKey: ["dashboard_widgets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("dashboard_widgets").select("*").eq("user_id", user!.id).order("position");
      if (error) throw error;
      return data as WidgetRow[];
    },
  });

  // Seed defaults on first visit
  useEffect(() => {
    if (!user || isLoading) return;
    if (widgets.length === 0) {
      (async () => {
        await supabase.from("dashboard_widgets").insert(
          DEFAULT_WIDGETS.map((k, i) => ({
            user_id: user.id, widget_key: k, position: i, size: WIDGETS[k].size,
          }))
        );
        qc.invalidateQueries({ queryKey: ["dashboard_widgets"] });
      })();
    }
  }, [user, widgets, isLoading, qc]);

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

  const usedKeys = new Set(widgets.map((w) => w.widget_key));
  const available = (Object.keys(WIDGETS) as WidgetKey[]).filter((k) => !usedKeys.has(k));

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gradient">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral da operação. Personalize os widgets.</p>
        </div>
        <div className="flex gap-2">
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
    case "stats_overview": return <StatsOverview />;
    case "cash_flow": return <CashFlow />;
    case "projects_by_status": return <ProjectsByStatus />;
    case "status_timer": return <StatusTimer />;
    case "upcoming_deadlines": return <UpcomingDeadlines />;
    case "recurring_revenue": return <RecurringRevenue />;
    case "team_load": return <TeamLoad />;
    case "equipment_depreciated": return <EquipmentDepreciated />;
    case "recent_projects": return <RecentProjects />;
  }
}

// ========== Widgets ==========

function StatsOverview() {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await supabase.from("projects").select("status_id, priority_id")).data ?? [],
  });
  const { data: statuses = [] } = useQuery({
    queryKey: ["workflow_statuses"],
    queryFn: async () => (await supabase.from("workflow_statuses").select("id, name, is_final")).data ?? [],
  });
  const { data: priorities = [] } = useQuery({
    queryKey: ["priorities"],
    queryFn: async () => (await supabase.from("priorities").select("id, name, level")).data ?? [],
  });
  const { data: teamCount = 0 } = useQuery({
    queryKey: ["team-count"],
    queryFn: async () => (await supabase.from("internal_profiles").select("id", { count: "exact", head: true })).count ?? 0,
  });

  const finalIds = new Set(statuses.filter((s) => s.is_final).map((s) => s.id));
  const urgentId = priorities.sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0]?.id;
  const total = projects.length;
  const done = projects.filter((p) => p.status_id && finalIds.has(p.status_id)).length;
  const open = total - done;
  const urgent = projects.filter((p) => p.priority_id === urgentId && (!p.status_id || !finalIds.has(p.status_id))).length;

  const stats = [
    { label: "Total", value: total, icon: FolderKanban, color: "text-info" },
    { label: "Em aberto", value: open, icon: Clock, color: "text-warning" },
    { label: "Concluídos", value: done, icon: CheckCircle2, color: "text-success" },
    { label: "Urgentes", value: urgent, icon: AlertTriangle, color: "text-destructive" },
    { label: "Equipe", value: teamCount, icon: Users, color: "text-primary" },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Indicadores gerais</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-muted/40 rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase text-muted-foreground">{s.label}</span>
                <Icon className={`h-3.5 w-3.5 ${s.color}`} />
              </div>
              <p className="text-2xl font-semibold">{s.value}</p>
            </div>
          );
        })}
      </div>
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
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await supabase.from("projects").select("status_id")).data ?? [],
  });
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
  const { data: projects = [] } = useQuery({
    queryKey: ["upcoming"],
    queryFn: async () => (await supabase.from("projects")
      .select("id, title, due_date, client_id, status_id")
      .gte("due_date", format(new Date(), "yyyy-MM-dd"))
      .order("due_date").limit(8)).data ?? [],
  });
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
          <Link key={p.id} to="/projects" className="flex items-center justify-between py-2 hover:bg-muted/30 -mx-1 px-1 rounded">
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

  const finalIds = new Set(statuses.filter((s) => s.is_final).map((s) => s.id));
  const openProjectIds = new Set(projects.filter((p) => !p.status_id || !finalIds.has(p.status_id)).map((p) => p.id));
  const counts = new Map<string, number>();
  for (const a of assignees) {
    if (openProjectIds.has(a.project_id)) counts.set(a.user_id, (counts.get(a.user_id) ?? 0) + 1);
  }
  const list = members.map((m) => ({ name: m.full_name, count: counts.get(m.id) ?? 0 }))
    .filter((m) => m.count > 0).sort((a, b) => b.count - a.count).slice(0, 6);

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Carga por profissional</h3>
      {list.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum responsável atribuído.</p> : (
        <div className="space-y-2">
          {list.map((m) => (
            <div key={m.name} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate">{m.name}</span>
              <div className="bg-primary/15 h-2 rounded-full" style={{ width: `${m.count * 14}px`, maxWidth: "60%" }} />
              <span className="text-xs text-muted-foreground w-6 text-right">{m.count}</span>
            </div>
          ))}
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
  const { data: projects = [] } = useQuery({
    queryKey: ["recent-projects"],
    queryFn: async () => (await supabase.from("projects").select("id, title, client_id, due_date, status_id").order("created_at", { ascending: false }).limit(5)).data ?? [],
  });
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
