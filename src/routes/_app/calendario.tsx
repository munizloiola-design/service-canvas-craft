import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format, isSameMonth, isSameDay,
  addMonths, subMonths, addWeeks, subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSectionGate } from "@/lib/access-sections";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/calendario")({ component: CalendarioPage });

type Project = {
  id: string; title: string; due_date: string | null; post_date: string | null;
  status_id: string | null; client_id: string | null;
  description: string | null; caption: string | null; notes: string | null;
};
type Status = { id: string; name: string; color: string };
type Client = { id: string; name: string };
type DateField = "due_date" | "post_date";

function CalendarioPage() {
  const calSec = useSectionGate("/calendario");
  const [tab, setTab] = useState<"due" | "post">(calSec.can("due") ? "due" : "post");
  const [view, setView] = useState<"month" | "week">(calSec.can("month") ? "month" : "week");
  const [cursor, setCursor] = useState(new Date());
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [detail, setDetail] = useState<Project | null>(null);
  const qc = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-cal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, title, due_date, post_date, status_id, client_id, description, caption, notes");
      if (error) throw error;
      return data as Project[];
    },
  });
  const { data: statuses = [] } = useQuery({
    queryKey: ["workflow_statuses"],
    queryFn: async () => (await supabase.from("workflow_statuses").select("id, name, color")).data as Status[] ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("id, name")).data as Client[] ?? [],
  });

  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);

  const dateField: DateField = tab === "due" ? "due_date" : "post_date";

  const eventsByDate = useMemo(() => {
    const m = new Map<string, Project[]>();
    for (const p of projects) {
      const d = p[dateField];
      if (!d) continue;
      const key = d.slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }
    return m;
  }, [projects, dateField]);

  const reschedule = useMutation({
    mutationFn: async ({ id, newDate }: { id: string; newDate: string }) => {
      const args = dateField === "due_date"
        ? { _id: id, _due_date: newDate }
        : { _id: id, _post_date: newDate };
      const { error } = await supabase.rpc("update_project_schedule", args);
      if (error) throw error;
    },
    onMutate: async ({ id, newDate }) => {
      await qc.cancelQueries({ queryKey: ["projects-cal"] });
      const prev = qc.getQueryData<Project[]>(["projects-cal"]);
      qc.setQueryData<Project[]>(["projects-cal"], (old) =>
        (old ?? []).map((p) => (p.id === id ? { ...p, [dateField]: newDate } : p))
      );
      return { prev };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["projects-cal"], ctx.prev);
      toast.error(e.message || "Falha ao reagendar");
    },
    onSuccess: (_d, { newDate }) => {
      toast.success(`Reagendado para ${format(new Date(newDate + "T00:00:00"), "dd/MM")}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["projects-cal"] }),
  });

  const days: Date[] = useMemo(() => {
    if (view === "month") {
      const monthStart = startOfMonth(cursor);
      const monthEnd = endOfMonth(cursor);
      const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      const arr: Date[] = [];
      for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) arr.push(d);
      return arr;
    }
    const wkStart = startOfWeek(cursor, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(wkStart, i));
  }, [cursor, view]);

  const rangeLabel = useMemo(() => {
    if (view === "month") return format(cursor, "MMMM yyyy", { locale: ptBR });
    const s = startOfWeek(cursor, { weekStartsOn: 0 });
    const e = endOfWeek(cursor, { weekStartsOn: 0 });
    return `${format(s, "dd MMM", { locale: ptBR })} – ${format(e, "dd MMM yyyy", { locale: ptBR })}`;
  }, [cursor, view]);

  const handleDrop = (dayKey: string, projectId: string | null) => {
    setDragOverKey(null);
    if (!projectId) return;
    const p = projects.find((x) => x.id === projectId);
    if (!p) return;
    const current = (p[dateField] ?? "").slice(0, 10);
    if (current === dayKey) return;
    reschedule.mutate({ id: projectId, newDate: dayKey });
  };

  const renderCard = (p: Project) => {
    const st = p.status_id ? statusMap.get(p.status_id) : null;
    return (
      <div
        key={p.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/project-id", p.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => setDetail(p)}
        className="w-full text-left text-[11px] px-1.5 py-1 rounded truncate cursor-grab active:cursor-grabbing hover:opacity-80"
        style={st ? { background: `${st.color}25`, color: st.color } : { background: "var(--muted)" }}
        title={`${p.title}${p.client_id ? ` — ${clientMap.get(p.client_id) ?? ""}` : ""}`}
      >
        {p.title}
      </div>
    );
  };

  const cellCommon = (dayKey: string) =>
    `bg-card p-1.5 flex flex-col gap-1 transition-colors ${
      dragOverKey === dayKey ? "ring-2 ring-primary ring-inset bg-primary/5" : ""
    }`;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Calendário</h1>
          <p className="text-muted-foreground mt-1">
            Arraste uma demanda para outro dia para reagendar {tab === "due" ? "o prazo" : "a postagem"}.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Tabs value={view} onValueChange={(v) => { setExpandedDay(null); setView(v as "month" | "week"); }}>
            <TabsList>
              {calSec.can("month") && <TabsTrigger value="month">Mês</TabsTrigger>}
              {calSec.can("week") && <TabsTrigger value="week">Semana</TabsTrigger>}
            </TabsList>
          </Tabs>
          <Tabs value={tab} onValueChange={(v) => { setExpandedDay(null); setTab(v as "due" | "post"); }}>
            <TabsList>
              {calSec.can("due") && <TabsTrigger value="due">Prazos</TabsTrigger>}
              {calSec.can("post") && <TabsTrigger value="post">Postagens</TabsTrigger>}
            </TabsList>
          </Tabs>
        </div>
      </header>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setExpandedDay(null);
              setCursor((c) => (view === "month" ? subMonths(c, 1) : subWeeks(c, 1)));
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold capitalize">{rangeLabel}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setExpandedDay(null); setCursor(new Date()); }}>Hoje</Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setExpandedDay(null);
                setCursor((c) => (view === "month" ? addMonths(c, 1) : addWeeks(c, 1)));
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="bg-muted/50 px-2 py-1.5 text-xs font-medium text-center text-muted-foreground">{d}</div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const items = eventsByDate.get(key) ?? [];
            const inMonth = view === "week" || isSameMonth(day, cursor);
            const isToday = isSameDay(day, new Date());
            const isExpanded = expandedDay === key;
            const maxVisible = isExpanded ? Infinity : view === "week" ? 20 : 3;
            const minH = isExpanded ? "min-h-[100px] h-auto" : view === "week" ? "min-h-[60vh]" : "min-h-[100px]";
            const highlightWeekToday = view === "week" && isToday;
            const cellStyle: React.CSSProperties | undefined = highlightWeekToday
              ? { background: "color-mix(in oklab, hsl(var(--primary)) 15%, transparent)" }
              : undefined;
            return (
              <div
                key={key}
                style={cellStyle}
                className={`${cellCommon(key)} ${minH} ${inMonth ? "" : "opacity-40"}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverKey !== key) setDragOverKey(key); }}
                onDragLeave={() => { if (dragOverKey === key) setDragOverKey(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/project-id");
                  handleDrop(key, id || null);
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-medium ${
                      isToday && view === "month"
                        ? "bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center"
                        : highlightWeekToday
                        ? "text-primary font-semibold"
                        : ""
                    }`}
                  >
                    {format(day, view === "week" ? "d/MM" : "d")}
                  </span>
                </div>
                <div className={`flex-1 space-y-1 ${isExpanded ? "" : "overflow-y-auto"}`}>
                  {items.slice(0, maxVisible).map(renderCard)}
                  {items.length > maxVisible && (
                    <button
                      type="button"
                      onClick={() => setExpandedDay(key)}
                      className="text-[9px] rounded px-1.5 py-0.5 bg-secondary text-secondary-foreground hover:opacity-80"
                    >
                      +{items.length - maxVisible} ver todas
                    </button>
                  )}
                  {isExpanded && (
                    <button
                      type="button"
                      onClick={() => setExpandedDay(null)}
                      className="text-[9px] text-muted-foreground hover:text-foreground underline"
                    >
                      mostrar menos
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 shrink-0 border-b">
            <DialogTitle className="break-words pr-6 text-left">{detail?.title}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm overflow-y-auto px-6 py-4 flex-1 min-h-0">
              <div className="flex flex-wrap gap-2">
                {detail.status_id && statusMap.get(detail.status_id) && (
                  <Badge
                    className="border-0"
                    style={{
                      background: `${statusMap.get(detail.status_id)!.color}25`,
                      color: statusMap.get(detail.status_id)!.color,
                    }}
                  >
                    {statusMap.get(detail.status_id)!.name}
                  </Badge>
                )}
                {detail.client_id && <Badge variant="secondary">{clientMap.get(detail.client_id) ?? "Cliente"}</Badge>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Prazo:</span> {detail.due_date ? new Date(detail.due_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</div>
                <div><span className="text-muted-foreground">Postagem:</span> {detail.post_date ? new Date(detail.post_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</div>
              </div>
              {detail.description && <p className="whitespace-pre-wrap break-words text-muted-foreground">{detail.description}</p>}
              {detail.notes && (
                <div><p className="text-xs text-muted-foreground mb-1">Direção de arte</p><p className="whitespace-pre-wrap break-words">{detail.notes}</p></div>
              )}
              {detail.caption && (
                <div><p className="text-xs text-muted-foreground mb-1">Legenda</p><p className="whitespace-pre-wrap break-words">{detail.caption}</p></div>
              )}
            </div>
          )}
          <DialogFooter className="px-6 py-4 shrink-0 border-t gap-2">
            {detail && (
              <Button asChild variant="outline">
                <Link to="/projects" search={{ detail: detail.id }}>
                  <ExternalLink className="h-4 w-4 mr-1" /> Abrir em Demandas
                </Link>
              </Button>
            )}
            <Button onClick={() => setDetail(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
