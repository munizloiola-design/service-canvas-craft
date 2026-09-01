import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useRef } from "react";
import { usePersistedState, persistKey } from "@/hooks/use-persisted-state";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format, isSameMonth, isSameDay,
  addMonths, subMonths, addWeeks, subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useSectionGate, useCalendarStageGate, useStageGate } from "@/lib/access-sections";
import { useDeliverables, uploadDeliverable, deleteDeliverable, openDeliverable, type Deliverable } from "@/lib/deliverables";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, ChevronDown, ExternalLink, X, Link as LinkIcon, Paperclip, Download, Trash2 } from "lucide-react";
import { ProjectChat } from "@/components/ProjectChat";
import { useFieldVisibility } from "@/lib/field-visibility";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { useProjectMediaTypes, mediaIdsOf } from "@/lib/project-media-types";
import { toast } from "sonner";
import { CorrectionDeadlineDialog, isCorrecaoStatus } from "@/components/CorrectionDeadlineDialog";

type CalSearch = { resp: string; equipe: string; cliente: string; fase: string; prioridade: string };

export const Route = createFileRoute("/_app/calendario")({
  validateSearch: (s: Record<string, unknown>): CalSearch => ({
    resp: typeof s.resp === "string" ? s.resp : "",
    equipe: typeof s.equipe === "string" ? s.equipe : "",
    cliente: typeof s.cliente === "string" ? s.cliente : "",
    fase: typeof s.fase === "string" ? s.fase : "",
    prioridade: typeof s.prioridade === "string" ? s.prioridade : "",
  }),
  component: CalendarioPage,
});

type Project = {
  id: string; title: string; due_date: string | null; post_date: string | null;
  status_id: string | null; client_id: string | null; assigned_to: string | null; priority_id: string | null;
  description: string | null; caption: string | null; notes: string | null; team_id: string | null;
  media_type_id: string | null; reference_links: string[] | null; deliverable_path: string | null; final_link: string | null;
};
type Status = { id: string; name: string; color: string };
type Client = { id: string; name: string };
type Priority = { id: string; name: string; level: number; color: string };
type DateField = "due_date" | "post_date";

function CalendarioPage() {
  const { user, isManager } = useAuth();
  const calSec = useSectionGate("/calendario");
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/calendario" });
  const filtersKey = persistKey("calendario", "filters", user?.id);
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || typeof window === "undefined") return;
    restored.current = true;
    const hasUrl = !!(search.resp || search.equipe || search.cliente || search.fase || search.prioridade);
    if (hasUrl) return;
    try {
      const raw = window.localStorage.getItem(filtersKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as CalSearch;
      if (saved.resp || saved.equipe || saved.cliente || saved.fase || saved.prioridade) {
        navigate({ search: () => saved, replace: true });
      }
    } catch {
      /* ignora valor inválido */
    }
  }, [filtersKey, navigate, search]);
  useEffect(() => {
    if (!restored.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(filtersKey, JSON.stringify(search));
    } catch {
      /* ignora */
    }
  }, [filtersKey, search]);
  const setFilter = (key: keyof CalSearch, value: string) =>
    navigate({ search: (prev) => ({ ...prev, [key]: value === "__all" ? "" : value }) });
  const listOf = (v: string) => (v ? v.split(",").filter(Boolean) : []);
  const setMulti = (key: keyof CalSearch, values: string[]) => setFilter(key, values.join(","));
  const clearFilters = () =>
    navigate({ search: () => ({ resp: "", equipe: "", cliente: "", fase: "", prioridade: "" }) });
  const hasFilters = !!(search.resp || search.equipe || search.cliente || search.fase || search.prioridade);
  const [tab, setTab] = usePersistedState<"due" | "post">(
    persistKey("calendario", "tab", user?.id),
    calSec.can("due") ? "due" : "post",
  );
  const [view, setView] = usePersistedState<"month" | "week">(
    persistKey("calendario", "view", user?.id),
    calSec.can("month") ? "month" : "week",
  );
  const [cursor, setCursor] = useState(new Date());
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [detail, setDetail] = useState<Project | null>(null);
  const qc = useQueryClient();

  const { canSee, canEdit } = useFieldVisibility();
  const canSeeCalendarStage = useCalendarStageGate();
  const canSeeKanbanStage = useStageGate();
  const projectMediaMap = useProjectMediaTypes();
  const [linkDraft, setLinkDraft] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [legendOpen, setLegendOpen] = usePersistedState<boolean>(persistKey("calendario", "legend", user?.id), true);

  const openDetail = (p: Project) => {
    setLinkDraft(p.final_link ?? "");
    setDetail(p);
  };

  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects-cal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, title, due_date, post_date, status_id, client_id, assigned_to, priority_id, description, caption, notes, team_id, media_type_id, reference_links, deliverable_path, final_link");
      if (error) throw error;
      return data as Project[];
    },
  });

  const { data: mediaTypes = [] } = useQuery({
    queryKey: ["media_types_cal"],
    queryFn: async () => ((await supabase.from("media_types").select("id, name")).data ?? []) as { id: string; name: string }[],
  });
  const mediaMap = useMemo(() => new Map(mediaTypes.map((m) => [m.id, m.name])), [mediaTypes]);

  const { data: attachments = [] } = useQuery({
    queryKey: ["project_attachments_cal", detail?.id],
    enabled: !!detail,
    queryFn: async () =>
      ((await supabase.from("project_attachments").select("id, file_name, file_path").eq("project_id", detail!.id)).data ?? []) as { id: string; file_name: string; file_path: string }[],
  });

  const downloadFile = async (path: string) => {
    const { data } = await supabase.storage.from("project-files").createSignedUrl(path, 60);
    if (data) window.open(data.signedUrl, "_blank");
  };

  const removeAttachment = useMutation({
    mutationFn: async (att: { id: string; file_path: string }) => {
      await supabase.storage.from("project-files").remove([att.file_path]);
      const { error } = await supabase.from("project_attachments").delete().eq("id", att.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_attachments_cal"] });
      qc.invalidateQueries({ queryKey: ["attachments"] });
      toast.success("Anexo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveFinalLink = async () => {
    if (!detail) return;
    setSavingLink(true);
    const value = linkDraft.trim() || null;
    const { error } = await supabase.from("projects").update({ final_link: value }).eq("id", detail.id);
    setSavingLink(false);
    if (error) { toast.error("Não foi possível salvar o link"); return; }
    setDetail({ ...detail, final_link: value });
    qc.invalidateQueries({ queryKey: ["projects-cal"] });
    toast.success("Link do material salvo");
  };

  const { data: deliverables = [] } = useDeliverables(detail?.id);

  const removeDeliverable = useMutation({
    mutationFn: async (item: Deliverable) => {
      await deleteDeliverable(detail!.id, item);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_deliverables", detail?.id] });
      qc.invalidateQueries({ queryKey: ["projects-cal"] });
      toast.success("Material removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadDeliverables = async (files: FileList) => {
    if (!detail) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        await uploadDeliverable(detail.id, file, user?.id);
      } catch {
        toast.error(`Falha ao enviar ${file.name}`);
      }
    }
    setUploading(false);
    qc.invalidateQueries({ queryKey: ["project_deliverables", detail.id] });
    qc.invalidateQueries({ queryKey: ["projects-cal"] });
    toast.success("Material enviado");
  };




  const { data: assignees = [] } = useQuery({
    queryKey: ["project_assignees_cal"],
    queryFn: async () =>
      ((await supabase.from("project_assignees").select("project_id, user_id")).data ?? []) as { project_id: string; user_id: string }[],
  });
  // Visibilidade: usuários comuns veem apenas demandas onde estão marcados
  const projects = useMemo(() => {
    const visible = allProjects.filter((p) => canSeeCalendarStage(p.status_id));
    if (isManager || !user) return visible;
    const mine = new Set(assignees.filter((a) => a.user_id === user.id).map((a) => a.project_id));
    return visible.filter((p) => p.assigned_to === user.id || mine.has(p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProjects, assignees, isManager, user, canSeeCalendarStage]);

  const { data: statuses = [] } = useQuery({
    queryKey: ["workflow_statuses"],
    queryFn: async () => (await supabase.from("workflow_statuses").select("id, name, color").order("sort_order")).data as Status[] ?? [],
  });
  // Troca de etapa direto no modal; entrar em Correção pergunta sobre o prazo
  const [correctionTarget, setCorrectionTarget] = useState<{ id: string; title: string; due_date: string | null } | null>(null);
  const changeStatus = useMutation({
    mutationFn: async ({ id, status_id }: { id: string; status_id: string }) => {
      const { error } = await supabase.from("projects").update({ status_id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      const st = statusMap.get(vars.status_id);
      setDetail((cur) => (cur && cur.id === vars.id ? { ...cur, status_id: vars.status_id } : cur));
      qc.invalidateQueries({ queryKey: ["projects-cal"] });
      toast.success("Etapa atualizada");
      if (isCorrecaoStatus(st?.name) && detail) {
        setCorrectionTarget({ id: detail.id, title: detail.title, due_date: detail.due_date });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("id, name")).data as Client[] ?? [],
  });

  const { data: priorities = [] } = useQuery({
    queryKey: ["priorities"],
    queryFn: async () => (await supabase.from("priorities").select("id, name, level, color").order("level", { ascending: false })).data as Priority[] ?? [],
  });

  const { data: people = [] } = useQuery({
    queryKey: ["internal_profiles_cal"],
    enabled: isManager,
    queryFn: async () =>
      ((await supabase.from("internal_profiles").select("id, full_name").order("full_name")).data ?? []) as { id: string; full_name: string }[],
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams_cal"],
    enabled: isManager,
    queryFn: async () =>
      ((await supabase.from("teams").select("id, name").order("name")).data ?? []) as { id: string; name: string }[],
  });

  const visibleStatuses = useMemo(
    () => statuses.filter((s) => canSeeCalendarStage(s.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statuses, canSeeCalendarStage],
  );

  // No modal, a troca de etapa segue as fases liberadas no Kanban (Demandas),
  // mais a etapa atual da demanda (para o seletor nunca ficar inválido).
  const modalStatuses = useMemo(
    () => statuses.filter((s) => canSeeKanbanStage(s.id) || s.id === detail?.status_id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statuses, canSeeKanbanStage, detail?.status_id],
  );

  const priorityMap = useMemo(() => new Map(priorities.map((p) => [p.id, p])), [priorities]);

  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);

  const assigneesByProject = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const a of assignees) {
      if (!m.has(a.project_id)) m.set(a.project_id, new Set());
      m.get(a.project_id)!.add(a.user_id);
    }
    return m;
  }, [assignees]);

  const filteredProjects = useMemo(() => {
    if (!isManager) return projects;
    return projects.filter((p) => {
      const resp = listOf(search.resp);
      if (resp.length) {
        const ass = assigneesByProject.get(p.id);
        const ok = resp.some((r) => p.assigned_to === r || ass?.has(r));
        if (!ok) return false;
      }
      const equipe = listOf(search.equipe);
      if (equipe.length && !equipe.includes(p.team_id ?? "")) return false;
      const cliente = listOf(search.cliente);
      if (cliente.length && !cliente.includes(p.client_id ?? "")) return false;
      const fase = listOf(search.fase);
      if (fase.length && !fase.includes(p.status_id ?? "")) return false;
      const prioridade = listOf(search.prioridade);
      if (prioridade.length && !prioridade.includes(p.priority_id ?? "")) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, isManager, search, assigneesByProject]);

  const dateField: DateField = tab === "due" ? "due_date" : "post_date";

  const eventsByDate = useMemo(() => {
    const m = new Map<string, Project[]>();
    for (const p of filteredProjects) {
      const d = p[dateField];
      if (!d) continue;
      const key = d.slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }
    const level = (p: Project) => (p.priority_id ? priorityMap.get(p.priority_id)?.level ?? -1e9 : -1e9);
    for (const list of m.values()) {
      list.sort((a, b) => level(b) - level(a) || a.title.localeCompare(b.title, "pt-BR"));
    }
    return m;
  }, [filteredProjects, dateField, priorityMap]);

  const shownCount = useMemo(
    () => filteredProjects.filter((p) => !!p[dateField]).length,
    [filteredProjects, dateField],
  );


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
    const pr = p.priority_id ? priorityMap.get(p.priority_id) : null;
    return (
      <div
        key={p.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/project-id", p.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => openDetail(p)}
        className="w-full text-left text-[11px] px-1.5 py-1 rounded truncate cursor-grab active:cursor-grabbing hover:opacity-80 flex items-center gap-1"
        style={st ? { background: `${st.color}25`, color: st.color } : { background: "var(--muted)" }}
        title={`${p.title}${p.client_id ? ` — ${clientMap.get(p.client_id) ?? ""}` : ""}${pr ? ` — ${pr.name}` : ""}`}
      >
        {pr && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: pr.color }} />}
        <span className="truncate">{p.title}</span>
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

      {isManager && (
        <Card className="p-4 mb-4">
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <MultiSelectFilter className="h-10 w-full" placeholder="Todos os responsáveis"
              options={people.map((p) => ({ value: p.id, label: p.full_name }))}
              values={listOf(search.resp)} onChange={(v) => setMulti("resp", v)} />
            <MultiSelectFilter className="h-10 w-full" placeholder="Todas as equipes"
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
              values={listOf(search.equipe)} onChange={(v) => setMulti("equipe", v)} />
            <MultiSelectFilter className="h-10 w-full" placeholder="Todos os clientes"
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              values={listOf(search.cliente)} onChange={(v) => setMulti("cliente", v)} />
            <MultiSelectFilter className="h-10 w-full" placeholder="Todas as fases"
              options={visibleStatuses.map((st) => ({ value: st.id, label: st.name }))}
              values={listOf(search.fase)} onChange={(v) => setMulti("fase", v)} />
            <MultiSelectFilter className="h-10 w-full" placeholder="Todas as prioridades"
              options={priorities.map((p) => ({ value: p.id, label: p.name }))}
              values={listOf(search.prioridade)} onChange={(v) => setMulti("prioridade", v)} />
          </div>
          {hasFilters && (
            <div className="flex items-center gap-3 mt-3">
              <Badge variant="secondary">{shownCount} demanda{shownCount === 1 ? "" : "s"}</Badge>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" /> Limpar filtros
              </Button>
            </div>
          )}
        </Card>
      )}



      <Card className="p-3 mb-4">
        <button type="button" className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
          onClick={() => setLegendOpen((o) => !o)}>
          {legendOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Legenda de cores
        </button>
        {legendOpen && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] uppercase text-muted-foreground w-16">Fluxo</span>
              {visibleStatuses.map((st) => (
                <span key={st.id} className="inline-flex items-center gap-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: `${st.color}` }} />
                  {st.name}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] uppercase text-muted-foreground w-16">Prioridade</span>
              {priorities.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

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
                  <Select
                    value={detail.status_id}
                    onValueChange={(v) => v !== detail.status_id && changeStatus.mutate({ id: detail.id, status_id: v })}
                    disabled={changeStatus.isPending}
                  >
                    <SelectTrigger
                      className="h-6 w-auto gap-1.5 rounded-full border-0 px-2.5 text-xs font-medium"
                      style={{
                        background: `${statusMap.get(detail.status_id)!.color}25`,
                        color: statusMap.get(detail.status_id)!.color,
                      }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleStatuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                            {s.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {detail.client_id && <Badge variant="secondary">{clientMap.get(detail.client_id) ?? "Cliente"}</Badge>}
                {canSee("media_type") && mediaIdsOf(projectMediaMap, detail).map((id) => mediaMap.get(id)).filter(Boolean).length > 0 && (
                  <Badge variant="outline">{mediaIdsOf(projectMediaMap, detail).map((id) => mediaMap.get(id)).filter(Boolean).join(", ")}</Badge>
                )}
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

              {canSee("reference_links") && ((detail.reference_links?.length ?? 0) > 0 || attachments.length > 0) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Referências</p>
                  <ul className="space-y-1">
                    {(detail.reference_links ?? []).map((url, i) => (
                      <li key={i}>
                        <a href={url} target="_blank" rel="noreferrer" className="text-info hover:underline inline-flex items-center gap-1 break-all">
                          <LinkIcon className="h-3 w-3" /> {url}
                        </a>
                      </li>
                    ))}
                    {attachments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50">
                        <span className="inline-flex items-center gap-2 truncate"><Paperclip className="h-3.5 w-3.5" /><span className="truncate">{a.file_name}</span></span>
                        <span className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => downloadFile(a.file_path)}><Download className="h-3.5 w-3.5" /></Button>
                          {canEdit("reference_links") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              aria-label={`Excluir ${a.file_name}`}
                              onClick={() => { if (confirm(`Excluir o anexo ${a.file_name}?`)) removeAttachment.mutate({ id: a.id, file_path: a.file_path }); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(canSee("deliverable_path") || canSee("final_link")) && (
                <div className="border rounded-md p-3 bg-muted/30 space-y-2">
                  <p className="text-xs uppercase text-muted-foreground">Material do cliente</p>
                  {canSee("deliverable_path") && (
                    <div className="space-y-2">
                      {deliverables.length === 0 ? (
                        !canEdit("deliverable_path") && <p className="text-xs text-muted-foreground">Nenhum arquivo enviado.</p>
                      ) : (
                        <ul className="space-y-1">
                          {deliverables.map((d) => (
                            <li key={d.id} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50">
                              <span className="inline-flex items-center gap-2 truncate"><Paperclip className="h-3.5 w-3.5" /><span className="truncate">{d.file_name}</span></span>
                              <span className="flex items-center gap-1 shrink-0">
                                <Button variant="ghost" size="sm" onClick={() => openDeliverable(d.file_path)}><Download className="h-3.5 w-3.5" /></Button>
                                {canEdit("deliverable_path") && (
                                  <Button variant="ghost" size="sm" className="text-destructive" disabled={removeDeliverable.isPending}
                                    aria-label={`Excluir ${d.file_name}`}
                                    onClick={() => { if (confirm(`Excluir ${d.file_name}?`)) removeDeliverable.mutate(d); }}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {canEdit("deliverable_path") && (
                        <Input
                          type="file"
                          multiple
                          disabled={uploading}
                          onChange={(e) => e.target.files?.length && uploadDeliverables(e.target.files)}
                        />
                      )}
                    </div>
                  )}
                  {canSee("final_link") && (
                    canEdit("final_link") ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={linkDraft}
                          onChange={(e) => setLinkDraft(e.target.value)}
                          placeholder="https://link do material"
                          className="h-8 text-xs"
                        />
                        <Button size="sm" onClick={saveFinalLink} disabled={savingLink}>Salvar</Button>
                      </div>
                    ) : detail.final_link ? (
                      <a href={detail.final_link} target="_blank" rel="noreferrer" className="text-info hover:underline inline-flex items-center gap-1 break-all text-xs">
                        <LinkIcon className="h-3 w-3" /> {detail.final_link}
                      </a>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhum link cadastrado.</p>
                    )
                  )}
                </div>
              )}

              <ProjectChat projectId={detail.id} />

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

      <CorrectionDeadlineDialog
        target={correctionTarget}
        onClose={() => setCorrectionTarget(null)}
        invalidateKeys={[["projects-cal"]]}
      />
    </div>
  );
}
