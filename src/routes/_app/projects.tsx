import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Plus, Calendar, Trash2, Paperclip, Link as LinkIcon, Eye, Download, Copy, X, Columns3, Upload, Filter, Pencil, ArrowUp, ArrowDown, ArrowUpDown, Search } from "lucide-react";
import { toast } from "sonner";
import { useFieldVisibility } from "@/lib/field-visibility";
import { useAccess } from "@/lib/access-context";
import { useSectionGate, useStageGate, useStageRules } from "@/lib/access-sections";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { ProjectChat } from "@/components/ProjectChat";
import { usePersistedState, persistKey } from "@/hooks/use-persisted-state";

export const Route = createFileRoute("/_app/projects")({
  component: ProjectsPage,
  validateSearch: (s: Record<string, unknown>): { detail?: string; quick?: QuickFilter } => ({
    detail: typeof s.detail === "string" ? s.detail : undefined,
    quick:
      s.quick === "abertas" || s.quick === "concluidas" || s.quick === "urgentes" || s.quick === "atrasadas"
        ? (s.quick as QuickFilter)
        : undefined,
  }),

});

type QuickFilter = "abertas" | "concluidas" | "urgentes" | "atrasadas";
const QUICK_LABELS: Record<QuickFilter, string> = {
  abertas: "Em aberto",
  concluidas: "Concluídas",
  urgentes: "Urgentes",
  atrasadas: "Atrasadas",
};


type DescriptionCard = { title: string; content: string };
type Project = {
  id: string; title: string; description: string | null; notes: string | null;
  caption: string | null;
  description_cards: DescriptionCard[] | null;
  final_link: string | null;
  client_id: string | null; client_name: string | null;
  media_type_id: string | null; status_id: string | null; priority_id: string | null;
  start_date: string | null; due_date: string | null; post_date: string | null;
  has_reference: boolean; reference_links: string[];
  budget: number | null; deliverable_path: string | null;
  client_token: string | null; client_decision: string | null; client_feedback: string | null;
  created_at: string;
  assigned_to?: string | null;
  team_id?: string | null;
};
type Client = { id: string; name: string };
type MediaType = { id: string; name: string };
type Status = { id: string; name: string; color: string; sort_order: number; is_final?: boolean };
type Priority = { id: string; name: string; color: string; level: number };
type Role = { id: string; name: string };
type Profile = { id: string; full_name: string };
type Team = { id: string; name: string };
type Assignee = { id: string; project_id: string; user_id: string; role_id: string | null };

const ALL_COLUMNS = [
  { key: "title", label: "Título" },
  { key: "client", label: "Cliente" },
  { key: "media", label: "Tipo de mídia" },
  { key: "status", label: "Etapa" },
  { key: "priority", label: "Prioridade" },
  { key: "assignees", label: "Responsáveis" },
  { key: "due_date", label: "Prazo" },
  { key: "post_date", label: "Postagem" },
] as const;

function priorityLevelOf(p: Project, maps: Record<string, Map<string, unknown>>): number {
  if (!p.priority_id) return -Infinity;
  const pr = maps.priority?.get(p.priority_id) as { level?: number } | undefined;
  return pr?.level ?? -Infinity;
}

function comparePriorityThenDue(a: Project, b: Project, maps: Record<string, Map<string, unknown>>): number {
  const la = priorityLevelOf(a, maps);
  const lb = priorityLevelOf(b, maps);
  if (la !== lb) return lb - la;
  const da = a.due_date ?? "9999-12-31";
  const db = b.due_date ?? "9999-12-31";
  if (da !== db) return da < db ? -1 : 1;
  return a.title.localeCompare(b.title, "pt-BR");
}

type FilterKey = "client" | "assignee" | "status" | "priority" | "media" | "decision" | "due_from" | "due_to" | "post_from" | "post_to";
type ActiveFilter = { key: FilterKey; values: string[] };
const DATE_FILTERS: FilterKey[] = ["due_from", "due_to", "post_from", "post_to"];

/** Aceita o formato antigo ({ value: string }) salvo no navegador. */
function normalizeFilter(f: ActiveFilter | { key: FilterKey; value?: string }): ActiveFilter {
  const values = (f as ActiveFilter).values;
  if (Array.isArray(values)) return { key: f.key, values };
  const legacy = (f as { value?: string }).value;
  return { key: f.key, values: legacy ? [legacy] : [] };
}

const FILTER_LABELS: Record<FilterKey, string> = {
  client: "Cliente", assignee: "Responsável", status: "Etapa", priority: "Prioridade",
  media: "Tipo de mídia", decision: "Decisão do cliente",
  due_from: "Prazo a partir de", due_to: "Prazo até",
  post_from: "Postagem a partir de", post_to: "Postagem até",
};

const COL_TO_FIELD: Record<string, string | null> = {
  title: null, status: null, assignees: "assignees",
  client: "client_id", media: "media_type", priority: "priority",
  due_date: "due_date", post_date: "post_date",
};

/** Colunas bloqueadas por Perfis e Acessos. Sem regras cadastradas = tudo liberado. */
function useColumnAccess() {
  const { fieldView } = useAccess();
  const hasRules = fieldView.size > 0;
  return (key: string) => {
    const field = COL_TO_FIELD[key];
    if (!field || !hasRules) return false;
    return !fieldView.has(field);
  };
}

function ProjectsPage() {
  const { user, isManager } = useAuth();
  const { menuAllowed } = useAccess();
  const isColBlocked = useColumnAccess();
  const canManageProjects = menuAllowed("/projects");
  const navigate = useNavigate();
  const search = Route.useSearch();
  const projSec = useSectionGate("/projects");
  const canSeeStage = useStageGate();
  const stageRules = useStageRules();

  const [view, setView] = usePersistedState<"kanban" | "list">(
    persistKey("projects", "view", user?.id),
    projSec.can("kanban") ? "kanban" : "list",
  );
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = usePersistedState<string[]>(
    persistKey("projects", "cols", user?.id),
    ALL_COLUMNS.map((c) => c.key),
  );
  const [rawFilters, setFilters] = usePersistedState<ActiveFilter[]>(persistKey("projects", "filters", user?.id), []);
  const filters = useMemo(() => rawFilters.map(normalizeFilter), [rawFilters]);
  const [query, setQuery] = usePersistedState<string>(persistKey("projects", "search", user?.id), "");
  const [quick, setQuick] = usePersistedState<QuickFilter | undefined>(
    persistKey("projects", "quick", user?.id),
    search.quick,
  );

  useEffect(() => {
    if (search.detail) setDetailId(search.detail);
  }, [search.detail]);

  useEffect(() => {
    // URL manda quando vem com filtro rápido; senão mantém o último usado
    if (search.quick) setQuick(search.quick);
  }, [search.quick, setQuick]);


  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Project[];
    },
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"], queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data as Client[] ?? [],
  });
  const { data: mediaTypes = [] } = useQuery({
    queryKey: ["media_types"], queryFn: async () => (await supabase.from("media_types").select("id, name").order("sort_order")).data as MediaType[] ?? [],
  });
  const { data: statuses = [] } = useQuery({
    queryKey: ["workflow_statuses"], queryFn: async () => (await supabase.from("workflow_statuses").select("*").order("sort_order")).data as Status[] ?? [],
  });
  const { data: priorities = [] } = useQuery({
    queryKey: ["priorities"], queryFn: async () => (await supabase.from("priorities").select("*").order("level")).data as Priority[] ?? [],
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["project_roles"], queryFn: async () => (await supabase.from("project_roles").select("id, name").order("name")).data as Role[] ?? [],
  });
  const { data: members = [] } = useQuery({
    queryKey: ["profiles"], queryFn: async () => (await supabase.from("internal_profiles").select("id, full_name").order("full_name")).data as Profile[] ?? [],
  });
  const { data: allAssignees = [] } = useQuery({
    queryKey: ["project_assignees"], queryFn: async () => (await supabase.from("project_assignees").select("*")).data as Assignee[] ?? [],
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("teams").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as Team[];
    },
  });

  const maps = useMemo(() => ({
    client: new Map(clients.map((c) => [c.id, c.name])),
    media: new Map(mediaTypes.map((m) => [m.id, m.name])),
    status: new Map(statuses.map((s) => [s.id, s])),
    priority: new Map(priorities.map((p) => [p.id, p])),
    role: new Map(roles.map((r) => [r.id, r.name])),
    member: new Map(members.map((m) => [m.id, m.full_name])),
  }), [clients, mediaTypes, statuses, priorities, roles, members]);

  const assigneesByProject = useMemo(() => {
    const m = new Map<string, Assignee[]>();
    for (const a of allAssignees) {
      if (!m.has(a.project_id)) m.set(a.project_id, []);
      m.get(a.project_id)!.push(a);
    }
    return m;
  }, [allAssignees]);

  // Visibilidade: usuários comuns veem apenas demandas onde estão marcados
  const visibleProjects = useMemo(() => {
    if (isManager || !user) return projects;
    return projects.filter(
      (p) =>
        p.assigned_to === user.id ||
        (assigneesByProject.get(p.id) ?? []).some((a) => a.user_id === user.id),
    );
  }, [projects, assigneesByProject, isManager, user]);

  // Fases liberadas para a especialidade (Perfis e Acessos → Demandas → Fase)
  // + fase de início: fases anteriores à fase inicial da especialidade somem
  const allowedStatuses = useMemo(
    () => statuses.filter((s) => canSeeStage(s.id) && stageRules.isStarted(s.id)),
    [statuses, canSeeStage, stageRules],
  );
  const allowedStatusIds = useMemo(() => new Set(allowedStatuses.map((s) => s.id)), [allowedStatuses]);


  const topPriorityId = useMemo(
    () => [...priorities].sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0]?.id,
    [priorities],
  );

  const filteredProjects = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const isDone = (p: Project) => stageRules.isDone(p.status_id);
    const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const term = norm(query.trim());
    return visibleProjects.filter((p) => {
      if (term) {
        const haystack = norm(
          [p.title, maps.client.get(p.client_id ?? "") ?? "", p.caption ?? "", p.description ?? "", p.notes ?? ""].join(" "),
        );
        if (!haystack.includes(term)) return false;
      }
      if (quick === "abertas" && isDone(p)) return false;
      if (quick === "concluidas" && !isDone(p)) return false;
      if (quick === "urgentes" && (isDone(p) || p.priority_id !== topPriorityId)) return false;
      if (quick === "atrasadas" && (isDone(p) || !p.due_date || p.due_date >= today)) return false;

      for (const f of filters) {
        if (!f.values.length) continue;
        const v0 = f.values[0];
        const has = (val: string | null | undefined) => f.values.includes(val ?? "");
        switch (f.key) {
          case "client": if (!has(p.client_id)) return false; break;
          case "status": if (!has(p.status_id)) return false; break;
          case "priority": if (!has(p.priority_id)) return false; break;
          case "media": {
            const ids = mediaIdsOf(projectMediaMap, p);
            if (!ids.some((id) => f.values.includes(id))) return false;
            break;
          }
          case "decision": if (!has(p.client_decision ?? "pending")) return false; break;
          case "assignee": {
            const ass = assigneesByProject.get(p.id) ?? [];
            if (!ass.some((a) => f.values.includes(a.user_id))) return false;
            break;
          }
          case "due_from": if (!p.due_date || p.due_date < v0) return false; break;
          case "due_to": if (!p.due_date || p.due_date > v0) return false; break;
          case "post_from": if (!p.post_date || p.post_date < v0) return false; break;
          case "post_to": if (!p.post_date || p.post_date > v0) return false; break;
        }
      }
      return true;
    });
  }, [visibleProjects, filters, assigneesByProject, quick, stageRules, topPriorityId, query, maps, projectMediaMap]);


  // Kanban e Lista só mostram demandas em fases liberadas
  const stageVisibleProjects = useMemo(
    () => filteredProjects.filter((p) => !p.status_id || allowedStatusIds.has(p.status_id)),
    [filteredProjects, allowedStatusIds],
  );

  const filterOptions: Record<FilterKey, { value: string; label: string }[]> = {
    client: clients.map((c) => ({ value: c.id, label: c.name })),
    assignee: members.map((m) => ({ value: m.id, label: m.full_name })),
    status: allowedStatuses.map((s) => ({ value: s.id, label: s.name })),

    priority: priorities.map((p) => ({ value: p.id, label: p.name })),
    media: mediaTypes.map((m) => ({ value: m.id, label: m.name })),
    decision: [
      { value: "pending", label: "Pendente" },
      { value: "aprovado", label: "Aprovado" },
      { value: "reprovado", label: "Reprovado" },
    ],
    due_from: [], due_to: [], post_from: [], post_to: [],
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Demandas</h1>
          <p className="text-muted-foreground mt-1">Acompanhe o fluxo da agência ponta a ponta.</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar demandas..."
              className="h-9 pl-8 w-56"
              aria-label="Pesquisar demandas"
            />
            {query && (
              <button
                type="button"
                aria-label="Limpar pesquisa"
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
                onClick={() => setQuery("")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm"><Filter className="h-4 w-4 mr-1" /> + Filtro</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Adicionar filtro</DropdownMenuLabel>
              {(Object.keys(FILTER_LABELS) as FilterKey[]).map((k) => (
                <DropdownMenuCheckboxItem key={k} checked={filters.some((f) => f.key === k)}
                  onCheckedChange={(v) => setFilters((cur) => v ? [...cur, { key: k, value: "" }] : cur.filter((f) => f.key !== k))}>
                  {FILTER_LABELS[k]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {view === "list" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><Columns3 className="h-4 w-4 mr-1" /> Colunas</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Mostrar colunas</DropdownMenuLabel>
                {ALL_COLUMNS.filter((c) => !isColBlocked(c.key)).map((c) => (
                  <DropdownMenuCheckboxItem key={c.key} checked={visibleCols.includes(c.key)}
                    onCheckedChange={(v) => setVisibleCols((cur) => v ? [...cur, c.key] : cur.filter((k) => k !== c.key))}>
                    {c.label}
                  </DropdownMenuCheckboxItem>
                ))}

              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canManageProjects && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingProject(null); }}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova demanda</Button></DialogTrigger>
              <NewDemandDialog
                key={editingProject?.id ?? "new"}
                editProject={editingProject}
                onClose={() => { setOpen(false); setEditingProject(null); }}
                clients={clients} mediaTypes={mediaTypes} statuses={allowedStatuses} priorities={priorities}
                roles={roles} members={members} teams={teams}
                existingAssignees={editingProject ? (assigneesByProject.get(editingProject.id) ?? []) : []}
              />
            </Dialog>
          )}
        </div>
      </header>

      {quick && (
        <div className="mb-4 flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            {QUICK_LABELS[quick]}
            <button
              type="button"
              className="ml-1 opacity-70 hover:opacity-100"
              onClick={() => { setQuick(undefined); navigate({ to: "/projects", search: { detail: undefined, quick: undefined } }); }}
              aria-label="Remover filtro"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}


      {filters.length > 0 && (
        <Card className="p-3 mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">Filtros:</span>
          {filters.map((f, i) => (
            <div key={`${f.key}-${i}`} className="flex items-center gap-1 bg-muted/50 rounded-md pl-2 pr-1 py-1">
              <span className="text-xs font-medium">{FILTER_LABELS[f.key]}:</span>
              {f.key === "due_from" || f.key === "due_to" || f.key === "post_from" || f.key === "post_to" ? (
                <Input type="date" value={f.value} className="h-7 text-xs w-36"
                  onChange={(e) => setFilters((cur) => cur.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
              ) : (
                <Select value={f.value} onValueChange={(v) => setFilters((cur) => cur.map((x, j) => j === i ? { ...x, value: v } : x))}>
                  <SelectTrigger className="h-7 text-xs w-44"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {filterOptions[f.key].map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                onClick={() => setFilters((cur) => cur.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={() => setFilters([])}>Limpar tudo</Button>
        </Card>
      )}

      <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "list")}>
        <TabsList>{projSec.can("kanban") && <TabsTrigger value="kanban">Kanban</TabsTrigger>}{projSec.can("list") && <TabsTrigger value="list">Lista</TabsTrigger>}</TabsList>

        <TabsContent value="kanban" className="mt-4">
          <KanbanView projects={stageVisibleProjects} statuses={allowedStatuses} priorities={priorities}
            assigneesByProject={assigneesByProject} maps={maps} onDetail={setDetailId} />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <ListView projects={stageVisibleProjects} visibleCols={visibleCols} maps={maps}
            assigneesByProject={assigneesByProject} onDetail={setDetailId}
            canManage={canManageProjects}
            onEdit={(p) => { setEditingProject(p); setOpen(true); }} />
        </TabsContent>

      </Tabs>

      <ProjectDetail
        project={projects.find((p) => p.id === detailId) ?? null}
        statuses={allowedStatuses} priorities={priorities} maps={maps}
        assignees={detailId ? (assigneesByProject.get(detailId) ?? []) : []}
        onClose={() => { setDetailId(null); if (search.detail) navigate({ to: "/projects", search: { detail: undefined } }); }}
        onEdit={(p) => { setDetailId(null); setEditingProject(p); setOpen(true); }}
      />
    </div>
  );
}

function KanbanView({ projects, statuses, priorities, maps, assigneesByProject, onDetail }: {
  projects: Project[]; statuses: Status[]; priorities: Priority[];
  assigneesByProject: Map<string, Assignee[]>;
  maps: ReturnType<typeof Object> & Record<string, Map<string, unknown>>;
  onDetail: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { canSee } = useFieldVisibility();
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);
  const updateStatus = useMutation({
    mutationFn: async ({ id, status_id, from }: { id: string; status_id: string; from: string | null }) => {
      const { error } = await supabase.rpc("update_project_schedule", { _id: id, _status_id: status_id });
      if (error) throw error;
      if (user) {
        await supabase.from("project_transitions").insert({
          project_id: id, from_status_id: from, to_status_id: status_id, changed_by: user.id,
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  if (statuses.length === 0) {
    return <Card className="p-4 md:p-8 text-center text-sm text-muted-foreground">Crie etapas em <strong>Cadastros → Etapas do fluxo</strong> para usar o kanban.</Card>;
  }

  const cols = [...statuses, { id: "__none__", name: "Sem etapa", color: "#64748b", sort_order: 999 } as Status];

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const from = (active.data.current as { from: string | null } | undefined)?.from ?? null;
    const to = String(over.id);
    if (to === (from ?? "__none__")) return;
    const newStatusId = to === "__none__" ? null : to;
    // optimistic update
    qc.setQueryData<Project[]>(["projects"], (old) =>
      old ? old.map((p) => (p.id === active.id ? { ...p, status_id: newStatusId } : p)) : old,
    );
    if (newStatusId) updateStatus.mutate({ id: String(active.id), status_id: newStatusId, from });
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:[grid-template-columns:repeat(var(--kanban-cols),minmax(0,1fr))] lg:overflow-x-auto"
        style={{ ["--kanban-cols" as never]: Math.min(cols.length, 5) }}>
        {cols.map((col) => {
          const items = projects
            .filter((p) => (p.status_id ?? "__none__") === col.id)
            .sort((a, b) => comparePriorityThenDue(a, b, maps));
          return (
            <KanbanColumn key={col.id} col={col}
              items={items}
              visibleItems={items.slice(0, 5)}
              overflowCount={Math.max(0, items.length - 5)}
              isExpanded={expandedColumn === col.id}
              onExpand={() => setExpandedColumn(col.id)}
              onClose={() => setExpandedColumn(null)}
              statuses={statuses} priorities={priorities} maps={maps}
              assigneesByProject={assigneesByProject} canSee={canSee}
              onDetail={onDetail}
              onStatusChange={(id, status_id, from) => updateStatus.mutate({ id, status_id, from })} />
          );
        })}
      </div>
    </DndContext>
  );
}

function KanbanColumn({ col, items, visibleItems, overflowCount, isExpanded, onExpand, onClose, statuses, priorities, maps, assigneesByProject, canSee, onDetail, onStatusChange }: {
  col: Status;
  items: Project[];
  visibleItems: Project[];
  overflowCount: number;
  isExpanded: boolean;
  onExpand: () => void;
  onClose: () => void;
  statuses: Status[]; priorities: Priority[];
  maps: Record<string, Map<string, unknown>>;
  assigneesByProject: Map<string, Assignee[]>;
  canSee: (k: never) => boolean;
  onDetail: (id: string) => void;
  onStatusChange: (id: string, status_id: string, from: string | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div className="flex flex-col">
      <div className="rounded-t-lg px-3 py-2 flex items-center justify-between border-l-4" style={{ borderColor: col.color, background: `${col.color}15` }}>
        <h3 className="text-sm font-semibold">{col.name}</h3>
        <span className="text-xs bg-background/80 rounded px-2">{items.length}</span>
      </div>
      <div ref={setNodeRef}
        className={`bg-card border border-t-0 rounded-b-lg p-2 space-y-2 min-h-[120px] md:min-h-[200px] transition-shadow ${isOver ? "ring-2 ring-primary" : ""}`}>
        {visibleItems.map((p) => (
          <KanbanCard key={p.id} project={p} statuses={statuses} priorities={priorities}
            maps={maps} assigneesByProject={assigneesByProject} canSee={canSee}
            onDetail={onDetail} onStatusChange={onStatusChange} />
        ))}
        {overflowCount > 0 && (
          <button
            type="button"
            onClick={onExpand}
            className="w-full text-xs text-center py-2 rounded-md bg-secondary text-secondary-foreground hover:opacity-80 transition-opacity"
          >
            +{overflowCount} demandas
          </button>
        )}
        {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Vazio</p>}
      </div>

      <Dialog open={isExpanded} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 shrink-0 border-b">
            <DialogTitle className="pr-6 text-left">{col.name} — {items.length} demandas</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4 flex-1 min-h-0 space-y-3">
            {items.map((p) => (
              <KanbanCard key={p.id} project={p} statuses={statuses} priorities={priorities}
                maps={maps} assigneesByProject={assigneesByProject} canSee={canSee}
                onDetail={(id) => { onClose(); onDetail(id); }}
                onStatusChange={onStatusChange} />
            ))}
          </div>
          <DialogFooter className="px-6 py-4 shrink-0 border-t gap-2">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KanbanCard({ project: p, statuses, priorities: _priorities, maps, assigneesByProject, canSee, onDetail, onStatusChange }: {
  project: Project; statuses: Status[]; priorities: Priority[];
  maps: Record<string, Map<string, unknown>>;
  assigneesByProject: Map<string, Assignee[]>;
  canSee: (k: never) => boolean;
  onDetail: (id: string) => void;
  onStatusChange: (id: string, status_id: string, from: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: p.id, data: { from: p.status_id },
  });
  const pr = p.priority_id ? (maps.priority.get(p.priority_id) as Priority | undefined) : null;
  const ass = assigneesByProject.get(p.id) ?? [];
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    touchAction: "none",
    ...(pr?.color ? { background: `${pr.color}1A`, borderLeft: `3px solid ${pr.color}` } : {}),
  };
  return (
    <Card ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="p-2.5 hover:shadow-md cursor-grab active:cursor-grabbing"
      onClick={() => !isDragging && onDetail(p.id)}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="font-medium text-sm leading-snug">{p.title}</h4>
        {pr && canSee("priority" as never) && <Badge className="border-0 text-[10px] shrink-0" style={{ background: `${pr.color}25`, color: pr.color }}>{pr.name}</Badge>}
      </div>
      {p.client_id && canSee("client_id" as never) && <p className="text-xs text-muted-foreground">{maps.client.get(p.client_id) as string}</p>}
      {p.media_type_id && canSee("media_type" as never) && <span className="inline-block text-[10px] bg-secondary px-1.5 py-0.5 rounded mt-1">{maps.media.get(p.media_type_id) as string}</span>}
      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground mt-2">
        {p.due_date && canSee("due_date" as never) && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(p.due_date).toLocaleDateString("pt-BR")}</span>}
        {ass.length > 0 && <span>{ass.length} resp.</span>}
      </div>
      <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <Select value={p.status_id ?? ""} onValueChange={(v) => onStatusChange(p.id, v, p.status_id)}>
          <SelectTrigger className="h-6 text-[11px] mt-2"><SelectValue placeholder="Mover para..." /></SelectTrigger>
          <SelectContent>{statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </Card>
  );
}

function ListView({ projects, visibleCols, maps, assigneesByProject, onDetail, canManage, onEdit }: {
  projects: Project[]; visibleCols: string[];
  maps: ReturnType<typeof Object> & Record<string, Map<string, unknown>>;
  assigneesByProject: Map<string, Assignee[]>;
  onDetail: (id: string) => void;
  canManage?: boolean;
  onEdit?: (p: Project) => void;
}) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project_assignees"] });
      toast.success("Demanda excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const isColBlocked = useColumnAccess();
  const allowedCols = visibleCols.filter((k) => !isColBlocked(k));
  const { user: listUser } = useAuth();
  const [sort, setSort] = usePersistedState<{ key: string; dir: "asc" | "desc" } | null>(
    persistKey("projects", "sort", listUser?.id),
    null,
  );

  const toggleSort = (key: string) => {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: "asc" };
      if (cur.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const sortedProjects = useMemo(() => {
    const list = [...projects];
    if (!sort) return list.sort((a, b) => comparePriorityThenDue(a, b, maps));
    const txt = (v: unknown) => (typeof v === "string" ? v : "");
    const valueOf = (p: Project): string | number => {
      switch (sort.key) {
        case "title": return p.title ?? "";
        case "client": return p.client_id ? txt(maps.client.get(p.client_id)) : "";
        case "media": return p.media_type_id ? txt(maps.media.get(p.media_type_id)) : "";
        case "status": {
          const st = p.status_id ? (maps.status.get(p.status_id) as { sort_order?: number } | undefined) : undefined;
          return st?.sort_order ?? Number.POSITIVE_INFINITY;
        }
        case "priority": {
          const lv = priorityLevelOf(p, maps);
          return lv === -Infinity ? Number.NEGATIVE_INFINITY : lv;
        }
        case "assignees":
          return (assigneesByProject.get(p.id) ?? []).map((a) => txt(maps.member.get(a.user_id))).sort().join(", ");
        case "due_date": return p.due_date ?? "";
        case "post_date": return p.post_date ?? "";
        default: return "";
      }
    };
    const emptyLast = (v: string | number) =>
      v === "" || v === Number.POSITIVE_INFINITY || v === Number.NEGATIVE_INFINITY;
    const mul = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      const va = valueOf(a); const vb = valueOf(b);
      const ea = emptyLast(va); const eb = emptyLast(vb);
      if (ea !== eb) return ea ? 1 : -1;
      if (ea && eb) return a.title.localeCompare(b.title, "pt-BR");
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
      return String(va).localeCompare(String(vb), "pt-BR") * mul;
    });
  }, [projects, sort, maps, assigneesByProject]);

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 border-b">
          <tr>
            {ALL_COLUMNS.filter((c) => allowedCols.includes(c.key)).map((c) => {
              const active = sort?.key === c.key;
              const Icon = active ? (sort!.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <th key={c.key} className="text-left px-3 py-2 font-medium text-xs uppercase text-muted-foreground">
                  <button type="button" onClick={() => toggleSort(c.key)}
                    className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground" : ""}`}
                    title="Ordenar por esta coluna">
                    {c.label}
                    <Icon className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`} />
                  </button>
                </th>
              );
            })}
            <th className="w-32"></th>
          </tr>
        </thead>
        <tbody>
          {sortedProjects.map((p) => {
            const ass = assigneesByProject.get(p.id) ?? [];
            const pr = p.priority_id ? (maps.priority.get(p.priority_id) as Priority | undefined) : null;
            const st = p.status_id ? (maps.status.get(p.status_id) as Status | undefined) : null;
            return (
              <tr key={p.id} className="border-b hover:bg-muted/30">
                {allowedCols.includes("title") && <td className="px-3 py-2 font-medium">{p.title}</td>}
                {allowedCols.includes("client") && <td className="px-3 py-2 text-muted-foreground">{p.client_id ? (maps.client.get(p.client_id) as string) : "—"}</td>}
                {allowedCols.includes("media") && <td className="px-3 py-2 text-muted-foreground">{p.media_type_id ? (maps.media.get(p.media_type_id) as string) : "—"}</td>}
                {allowedCols.includes("status") && <td className="px-3 py-2">{st ? <Badge className="border-0" style={{ background: `${st.color}25`, color: st.color }}>{st.name}</Badge> : "—"}</td>}
                {allowedCols.includes("priority") && <td className="px-3 py-2">{pr ? <Badge className="border-0" style={{ background: `${pr.color}25`, color: pr.color }}>{pr.name}</Badge> : "—"}</td>}
                {allowedCols.includes("assignees") && <td className="px-3 py-2 text-xs text-muted-foreground">{ass.map((a) => maps.member.get(a.user_id) as string ?? "?").join(", ") || "—"}</td>}
                {allowedCols.includes("due_date") && <td className="px-3 py-2 text-muted-foreground">{p.due_date ? new Date(p.due_date).toLocaleDateString("pt-BR") : "—"}</td>}
                {allowedCols.includes("post_date") && <td className="px-3 py-2 text-muted-foreground">{p.post_date ? new Date(p.post_date).toLocaleDateString("pt-BR") : "—"}</td>}
                <td className="px-2">
                  <div className="flex items-center justify-end gap-0.5">
                    <Button variant="ghost" size="sm" title="Ver detalhes" onClick={() => onDetail(p.id)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {canManage && onEdit && (
                      <Button variant="ghost" size="sm" title="Editar demanda" onClick={() => onEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canManage && (
                      <Button variant="ghost" size="sm" title="Excluir demanda"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={remove.isPending}
                        onClick={() => { if (confirm(`Excluir a demanda "${p.title}"?`)) remove.mutate(p.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {projects.length === 0 && <tr><td colSpan={allowedCols.length + 1} className="text-center py-8 text-muted-foreground text-sm">Nenhuma demanda</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}


function NewDemandDialog({ onClose, clients, mediaTypes, statuses, priorities, roles, members, teams, editProject, existingAssignees }: {
  onClose: () => void;
  clients: Client[]; mediaTypes: MediaType[]; statuses: Status[]; priorities: Priority[];
  roles: Role[]; members: Profile[]; teams: Team[];
  editProject?: Project | null;
  existingAssignees?: Assignee[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { canSee, canEdit } = useFieldVisibility();
  const ro = (f: Parameters<typeof canEdit>[0]) => !canEdit(f);
  const isEdit = !!editProject;

  const [files, setFiles] = useState<File[]>([]);
  const [refLinks, setRefLinks] = useState<string[]>(
    editProject?.reference_links && editProject.reference_links.length ? [...editProject.reference_links] : [""]
  );
  const [assignees, setAssignees] = useState<{ user_id: string; role_id: string }[]>(
    existingAssignees && existingAssignees.length
      ? existingAssignees.map((a) => ({ user_id: a.user_id, role_id: a.role_id ?? "" }))
      : [{ user_id: "", role_id: "" }]
  );
  const [clientId, setClientId] = useState<string>(editProject?.client_id ?? "");
  const [lastAutoFilledClient, setLastAutoFilledClient] = useState<string>(editProject?.client_id ?? "");
  const [teamId, setTeamId] = useState<string>(editProject?.team_id ?? "");
  const [lastAutoFilledTeam, setLastAutoFilledTeam] = useState<string>(editProject?.team_id ?? "");

  // Members of the selected internal team (Equipe responsável)
  const { data: internalTeamMemberIds = [], isFetching: fetchingTeamMembers } = useQuery({
    queryKey: ["team_members_for_team", teamId],
    enabled: !!teamId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from as any)("team_members").select("user_id").eq("team_id", teamId);
      return ((data ?? []) as { user_id: string }[]).map((x) => x.user_id);
    },
  });

  // Auto-fill assignees when the responsible team changes (keeps manual picks).
  useEffect(() => {
    if (!teamId || teamId === lastAutoFilledTeam) return;
    if (fetchingTeamMembers) return; // wait for members to load before deciding
    if (!internalTeamMemberIds.length) { setLastAutoFilledTeam(teamId); return; }
    setAssignees((cur) => {
      const existingIds = new Set(cur.filter((a) => a.user_id).map((a) => a.user_id));
      const toAdd = internalTeamMemberIds
        .filter((id) => !existingIds.has(id))
        .map((id) => ({ user_id: id, role_id: "" }));
      const kept = cur.filter((a) => a.user_id);
      const result = [...kept, ...toAdd];
      return result.length ? result : [{ user_id: "", role_id: "" }];
    });
    setLastAutoFilledTeam(teamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, fetchingTeamMembers, internalTeamMemberIds.join(",")]);

  // Load the default team assigned to the selected client (client_teams)
  const { data: clientTeamId, isFetching: fetchingClientTeam } = useQuery({
    queryKey: ["client_default_team_id", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from as any)("client_teams")
        .select("id")
        .eq("client_id", clientId)
        .eq("is_default", true)
        .maybeSingle();
      return (data?.id as string | null) ?? null;
    },
  });

  // Load members of that client_team
  const { data: teamMemberIds = [], isFetching: fetchingClientTeamMembers } = useQuery({
    queryKey: ["client_team_members_for_team", clientTeamId],
    enabled: !!clientTeamId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from as any)("client_team_members").select("user_id").eq("team_id", clientTeamId);
      return ((data ?? []) as { user_id: string }[]).map((x) => x.user_id);
    },
  });

  // Auto-fill assignees when client changes (creation flow, or manual client swap during edit).
  // Preserves manual additions and never blocks the user from editing.
  useEffect(() => {
    if (!clientId || clientId === lastAutoFilledClient) return;
    if (fetchingClientTeam || fetchingClientTeamMembers) return; // wait for data
    if (!teamMemberIds.length) { setLastAutoFilledClient(clientId); return; }
    setAssignees((cur) => {
      const existingIds = new Set(cur.filter((a) => a.user_id).map((a) => a.user_id));
      const toAdd = teamMemberIds.filter((id) => !existingIds.has(id)).map((id) => ({ user_id: id, role_id: "" }));
      const kept = cur.filter((a) => a.user_id);
      const result = [...kept, ...toAdd];
      return result.length ? result : [{ user_id: "", role_id: "" }];
    });
    setLastAutoFilledClient(clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, fetchingClientTeam, fetchingClientTeamMembers, teamMemberIds.join(",")]);

  const [hasRef, setHasRef] = useState(!!editProject?.has_reference);
  const [descCards, setDescCards] = useState<DescriptionCard[]>(() => {
    const existing = editProject?.description_cards;
    if (Array.isArray(existing) && existing.length) return existing.map((c) => ({ title: c.title || "", content: c.content || "" }));
    if (editProject?.description) return [{ title: "Card 01", content: editProject.description }];
    return [{ title: "Card 01", content: "" }];
  });
  const [finalLink, setFinalLink] = useState<string>(editProject?.final_link ?? "");

  const addCard = () =>
    setDescCards((cur) => [...cur, { title: `Card ${String(cur.length + 1).padStart(2, "0")}`, content: "" }]);
  const removeCard = (i: number) =>
    setDescCards((cur) => cur.filter((_, j) => j !== i).map((c, k) => ({ ...c, title: `Card ${String(k + 1).padStart(2, "0")}` })));
  const updateCard = (i: number, content: string) =>
    setDescCards((cur) => cur.map((c, j) => (j === i ? { ...c, content } : c)));

  const { data: existingAttachments = [] } = useQuery({
    queryKey: ["attachments", editProject?.id, "edit"],
    enabled: isEdit,
    queryFn: async () => (await supabase.from("project_attachments").select("*").eq("project_id", editProject!.id)).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const fd = new FormData(form);
      const cleanCards = descCards
        .map((c, i) => ({ title: c.title || `Card ${String(i + 1).padStart(2, "0")}`, content: c.content.trim() }))
        .filter((c) => c.content);
      const concatenated = cleanCards.map((c) => `${c.title}\n${c.content}`).join("\n\n");
      const base = {
        title: String(fd.get("title")),
        description: concatenated || null,
        description_cards: cleanCards,
        notes: String(fd.get("notes") || "") || null,
        caption: String(fd.get("caption") || "") || null,
        final_link: (finalLink.trim() || null),
        client_id: clientId || null,
        team_id: teamId || null,
        media_type_id: (fd.get("media_type_id") as string) || null,
        status_id: (fd.get("status_id") as string) || null,
        priority_id: (fd.get("priority_id") as string) || null,
        start_date: (fd.get("start_date") as string) || null,
        due_date: (fd.get("due_date") as string) || null,
        post_date: (fd.get("post_date") as string) || null,
        has_reference: hasRef,
        reference_links: refLinks.map((s) => s.trim()).filter(Boolean),
        budget: fd.get("budget") ? Number(fd.get("budget")) : null,
      } as Record<string, unknown>;

      // Campos não liberados em Perfis e Acessos não são renderizados; não devem
      // ser sobrescritos ao salvar.
      const hiddenMap: Record<string, string[]> = {
        client_id: ["client_id"],
        media_type: ["media_type_id"],
        priority: ["priority_id"],
        due_date: ["due_date"],
        post_date: ["post_date"],
        budget: ["budget"],
        notes: ["notes"],
        caption: ["caption"],
        reference_links: ["reference_links", "has_reference"],
        description: ["description", "description_cards"],
        final_link: ["final_link"],
        team_id: ["team_id"],
        start_date: ["start_date"],
      };
      for (const [field, keys] of Object.entries(hiddenMap)) {
        // Sem "ver" (campo não renderizado) ou sem "editar" (somente leitura):
        // em ambos os casos o valor não pode ser sobrescrito.
        if (!canSee(field as never) || !canEdit(field as never)) for (const k of keys) delete base[k];
      }


      let projectId: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = base as any;
      if (isEdit) {
        const { error } = await supabase.from("projects").update(payload).eq("id", editProject!.id);
        if (error) throw error;
        projectId = editProject!.id;
        if (canSee("assignees") && canEdit("assignees")) {
          await supabase.from("project_assignees").delete().eq("project_id", projectId);
        }
      } else {
        const { data, error } = await supabase.from("projects").insert({
          ...payload,
          title: String(fd.get("title")),
          client_token: crypto.randomUUID().replace(/-/g, ""),
          created_by: user?.id,
        }).select("id").single();

        if (error) throw error;
        projectId = data.id;
      }

      const validAssignees = canSee("assignees") && canEdit("assignees") ? assignees.filter((a) => a.user_id) : [];
      if (validAssignees.length) {
        const { error } = await supabase.from("project_assignees").insert(
          validAssignees.map((a) => ({ project_id: projectId, user_id: a.user_id, role_id: a.role_id || null }))
        );
        if (error) throw error;
      }

      for (const file of files) {
        const path = `${projectId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const up = await supabase.storage.from("project-files").upload(path, file);
        if (up.error) { toast.error(`Falha em ${file.name}`); continue; }
        await supabase.from("project_attachments").insert({
          project_id: projectId, file_name: file.name, file_path: path,
          file_size: file.size, mime_type: file.type, uploaded_by: user!.id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project_assignees"] });
      qc.invalidateQueries({ queryKey: ["attachments"] });
      toast.success(isEdit ? "Demanda atualizada" : "Demanda criada");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAttachment = useMutation({
    mutationFn: async (att: { id: string; file_path: string }) => {
      await supabase.storage.from("project-files").remove([att.file_path]);
      const { error } = await supabase.from("project_attachments").delete().eq("id", att.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attachments", editProject?.id, "edit"] });
      qc.invalidateQueries({ queryKey: ["attachments"] });
      toast.success("Anexo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{isEdit ? "Editar demanda" : "Nova demanda"}</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(e.currentTarget); }}>
        <div className="space-y-2">
          <Label htmlFor="title">Título *</Label>
          <Input id="title" name="title" required defaultValue={editProject?.title ?? ""} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {canSee("client_id") && (
            <Field label="Empresa / Cliente">
              <Select value={clientId} onValueChange={(v) => setClientId(v)} disabled={ro("client_id")}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
          {canSee("team_id") && (
          <Field label="Equipe responsável">
            <Select value={teamId} onValueChange={(v) => setTeamId(v)} disabled={ro("team_id")}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          )}
          {canSee("media_type") && <Field label="Tipo de mídia"><Select name="media_type_id" defaultValue={editProject?.media_type_id ?? undefined} disabled={ro("media_type")}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{mediaTypes.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></Field>}
          <Field label="Etapa"><Select name="status_id" defaultValue={editProject?.status_id ?? statuses[0]?.id}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></Field>
          {canSee("priority") && <Field label="Prioridade"><Select name="priority_id" defaultValue={editProject?.priority_id ?? undefined} disabled={ro("priority")}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{priorities.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></Field>}

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {canSee("start_date") && <Field label="Início"><Input name="start_date" type="date" defaultValue={editProject?.start_date ?? ""} readOnly={ro("start_date")} /></Field>}
          {canSee("due_date") && <Field label="Prazo"><Input name="due_date" type="date" defaultValue={editProject?.due_date ?? ""} readOnly={ro("due_date")} /></Field>}
          {canSee("post_date") && <Field label="Postagem"><Input name="post_date" type="date" defaultValue={editProject?.post_date ?? ""} readOnly={ro("post_date")} /></Field>}
        </div>

        {canSee("budget") && <Field label="Valor (R$)"><Input name="budget" type="number" step="0.01" defaultValue={editProject?.budget ?? ""} readOnly={ro("budget")} /></Field>}


        {clientId && teamMemberIds.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Time do cliente aplicado automaticamente: {teamMemberIds.length} responsável(is) pré-preenchido(s). Você ainda pode adicionar ou remover pessoas manualmente.
          </p>
        )}

        {teamId && internalTeamMemberIds.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Membros da equipe selecionada aplicados automaticamente: {internalTeamMemberIds.length} responsável(is). Você pode adicionar ou remover pessoas.
          </p>
        )}


        {canSee("assignees") && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Responsáveis</Label>
            {canEdit("assignees") && (
            <Button type="button" variant="outline" size="sm" onClick={() => setAssignees((a) => [...a, { user_id: "", role_id: "" }])}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
            )}
          </div>
          {assignees.map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Select value={a.user_id} disabled={ro("assignees")} onValueChange={(v) => setAssignees((cur) => cur.map((x, j) => j === i ? { ...x, user_id: v } : x))}>
                <SelectTrigger><SelectValue placeholder="Pessoa" /></SelectTrigger>
                <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name || "Sem nome"}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={a.role_id} disabled={ro("assignees")} onValueChange={(v) => setAssignees((cur) => cur.map((x, j) => j === i ? { ...x, role_id: v } : x))}>
                <SelectTrigger><SelectValue placeholder="Função" /></SelectTrigger>
                <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
              {canEdit("assignees") && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAssignees((cur) => cur.filter((_, j) => j !== i))}>
                <X className="h-4 w-4" />
              </Button>
              )}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Membros da equipe selecionada e usuários com funções correspondentes também terão visibilidade desta demanda.
          </p>
        </div>
        )}

        {canSee("reference_links") && (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="has_ref" checked={hasRef} onCheckedChange={(v) => setHasRef(!!v)} />
                <Label htmlFor="has_ref" className="cursor-pointer">Possui arquivos de referência</Label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Links de referência</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setRefLinks((l) => [...l, ""])}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
              {refLinks.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={url} onChange={(e) => setRefLinks((cur) => cur.map((u, j) => j === i ? e.target.value : u))} placeholder="https://..." />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRefLinks((cur) => cur.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </>
        )}

        {canSee("notes") && <Field label="Direção de arte"><Textarea name="notes" rows={2} defaultValue={editProject?.notes ?? ""} readOnly={ro("notes")} /></Field>}
        {canSee("caption") && <Field label="Legenda"><Textarea name="caption" rows={3} defaultValue={editProject?.caption ?? ""} readOnly={ro("caption")} /></Field>}


        {canSee("description") && (
        <div className="space-y-2">

          <Label>Briefing / Descrição</Label>
          <div className="space-y-3">
            {descCards.map((card, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">{card.title}</span>
                  {descCards.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeCard(i)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <Textarea
                  rows={3}
                  value={card.content}
                  onChange={(e) => updateCard(i, e.target.value)}
                  placeholder={`Descrição do ${card.title.toLowerCase()}...`}
                />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addCard}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar novo card
            </Button>
          </div>
        </div>
        )}


        {isEdit && existingAttachments.length > 0 && (
          <div className="space-y-2">
            <Label>Anexos existentes</Label>
            <ul className="space-y-1">
              {existingAttachments.map((a: any) => (
                <li key={a.id} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50 text-xs">
                  <span className="inline-flex items-center gap-1 truncate"><Paperclip className="h-3 w-3" />{a.file_name}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { if (confirm(`Remover ${a.file_name}?`)) removeAttachment.mutate({ id: a.id, file_path: a.file_path }); }}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <Label>{isEdit ? "Adicionar arquivo ou link finalizado" : "Arquivo ou link finalizado"}</Label>
          <Input
            type="url"
            placeholder="https://... (link do arquivo finalizado)"
            value={finalLink}
            onChange={(e) => setFinalLink(e.target.value)}
          />
          <Input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          {files.length > 0 && (
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {files.map((f, i) => <li key={i}><Paperclip className="h-3 w-3 inline mr-1" />{f.name}</li>)}
            </ul>
          )}
        </div>


        <DialogFooter>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando..." : (isEdit ? "Salvar alterações" : "Criar demanda")}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function ProjectDetail({ project, statuses, priorities, maps, assignees, onClose, onEdit }: {
  project: Project | null; statuses: Status[]; priorities: Priority[];
  maps: Record<string, Map<string, unknown>>;
  assignees: Assignee[];
  onClose: () => void;
  onEdit: (p: Project) => void;
}) {
  const qc = useQueryClient();
  const { isManager } = useAuth();
  const { menuAllowed } = useAccess();
  const canManageProjects = menuAllowed("/projects");
  const { canSee, canEdit } = useFieldVisibility();

  const { data: attachments = [] } = useQuery({
    queryKey: ["attachments", project?.id], enabled: !!project?.id,
    queryFn: async () => (await supabase.from("project_attachments").select("*").eq("project_id", project!.id)).data ?? [],
  });

  const updateField = useMutation({
    mutationFn: async (patch: Partial<Project>) => {
      const { error } = await supabase.from("projects").update(patch).eq("id", project!.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); toast.success("Atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("projects").delete().eq("id", project!.id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); toast.success("Removido"); onClose(); },
  });

  const removeAttachment = useMutation({
    mutationFn: async (att: { id: string; file_path: string }) => {
      await supabase.storage.from("project-files").remove([att.file_path]);
      const { error } = await supabase.from("project_attachments").delete().eq("id", att.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attachments"] });
      qc.invalidateQueries({ queryKey: ["project_attachments_cal"] });
      toast.success("Anexo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadDeliverable = async (file: File) => {
    if (!project) return;
    const path = `${project.id}/deliverable_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const up = await supabase.storage.from("project-files").upload(path, file);
    if (up.error) { toast.error(up.error.message); return; }
    updateField.mutate({ deliverable_path: path });
  };

  const removeDeliverable = useMutation({
    mutationFn: async (path: string) => {
      await supabase.storage.from("project-files").remove([path]);
      const { error } = await supabase.from("projects").update({ deliverable_path: null }).eq("id", project!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Material removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("project-files").createSignedUrl(path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  if (!project) return null;
  const validationUrl = project.client_token ? `${typeof window !== "undefined" ? window.location.origin : ""}/v/${project.client_token}` : null;
  const pr = project.priority_id ? (maps.priority.get(project.priority_id) as Priority | undefined) : null;

  return (
    <Dialog open={!!project} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{project.title}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          {canManageProjects && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => onEdit(project)}>
                <Pencil className="h-4 w-4 mr-1" /> Editar demanda
              </Button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {canSee("client_id") && <Info label="Cliente" value={project.client_id ? (maps.client.get(project.client_id) as string) : "—"} />}
            {canSee("media_type") && <Info label="Tipo de mídia" value={project.media_type_id ? (maps.media.get(project.media_type_id) as string) : "—"} />}
            <div>
              <Label className="text-xs text-muted-foreground">Etapa</Label>
              <Select value={project.status_id ?? ""} onValueChange={(v) => updateField.mutate({ status_id: v })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {canSee("priority") && (
              <div>
                <Label className="text-xs text-muted-foreground">Prioridade</Label>
                <Select value={project.priority_id ?? ""} onValueChange={(v) => updateField.mutate({ priority_id: v })}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{priorities.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {canSee("start_date") && <Info label="Início" value={project.start_date ? new Date(project.start_date).toLocaleDateString("pt-BR") : "—"} />}
            {canSee("due_date") && <Info label="Prazo" value={project.due_date ? new Date(project.due_date).toLocaleDateString("pt-BR") : "—"} />}
            {canSee("post_date") && <Info label="Postagem" value={project.post_date ? new Date(project.post_date).toLocaleDateString("pt-BR") : "—"} />}
            {pr && canSee("priority") && <Info label="Prioridade atual" value={pr.name} />}
          </div>

          {canSee("assignees") && (
          <div>
            <Label className="text-xs text-muted-foreground">Responsáveis</Label>
            {assignees.length === 0 ? <p className="text-muted-foreground mt-1">—</p> : (
              <ul className="mt-1 space-y-1">
                {assignees.map((a) => (
                  <li key={a.id} className="text-sm">
                    <strong>{maps.member.get(a.user_id) as string ?? "?"}</strong>
                    {a.role_id && <span className="text-muted-foreground"> — {maps.role.get(a.role_id) as string}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          )}

          {project.notes && canSee("notes") && <div><Label className="text-xs text-muted-foreground">Direção de arte</Label><p className="mt-1 whitespace-pre-wrap">{project.notes}</p></div>}
          {project.caption && canSee("caption") && <div><Label className="text-xs text-muted-foreground">Legenda</Label><p className="mt-1 whitespace-pre-wrap">{project.caption}</p></div>}
          {canSee("description") && (
            (canSee("description_cards") && project.description_cards && project.description_cards.length > 0) ? (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                {project.description_cards.map((c, i) => (
                  <div key={i} className="rounded-md border p-3 bg-muted/20">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">{c.title}</div>
                    <p className="whitespace-pre-wrap text-sm">{c.content}</p>
                  </div>
                ))}
              </div>
            ) : project.description ? (
              <div><Label className="text-xs text-muted-foreground">Descrição</Label><p className="mt-1 whitespace-pre-wrap">{project.description}</p></div>
            ) : null
          )}
          {project.final_link && (
            <div>
              <Label className="text-xs text-muted-foreground">Arquivo ou link finalizado</Label>
              <a href={project.final_link} target="_blank" rel="noreferrer" className="mt-1 text-info hover:underline inline-flex items-center gap-1 break-all">
                <LinkIcon className="h-3 w-3" /> {project.final_link}
              </a>
            </div>
          )}

          {project.reference_links?.length > 0 && canSee("reference_links") && (
            <div>
              <Label className="text-xs text-muted-foreground">Referências</Label>
              <ul className="mt-1 space-y-1">
                {project.reference_links.map((url, i) => (
                  <li key={i}><a href={url} target="_blank" rel="noreferrer" className="text-info hover:underline inline-flex items-center gap-1 break-all"><LinkIcon className="h-3 w-3" /> {url}</a></li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground">Anexos ({attachments.length})</Label>
            {attachments.length === 0 ? <p className="text-muted-foreground mt-1">Nenhum</p> : (
              <ul className="mt-1 space-y-1">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50">
                    <span className="inline-flex items-center gap-2 truncate"><Paperclip className="h-3.5 w-3.5" /><span className="truncate">{a.file_name}</span></span>
                    <span className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => downloadFile(a.file_path)}><Download className="h-3.5 w-3.5" /></Button>
                      {canManageProjects && (
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
            )}
          </div>

          {canSee("deliverable_path") && (
            <div className="border rounded-md p-3 bg-muted/30 space-y-2">
              <Label className="text-xs uppercase">Material para o cliente</Label>
              {project.deliverable_path ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate">Arquivo enviado ✓</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => downloadFile(project.deliverable_path!)}><Download className="h-3.5 w-3.5 mr-1" /> Baixar</Button>
                    {canEdit("deliverable_path") && (
                      <Button variant="outline" size="sm" className="text-destructive" disabled={removeDeliverable.isPending}
                        onClick={() => { if (confirm("Excluir o arquivo do material?")) removeDeliverable.mutate(project.deliverable_path!); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <Input type="file" onChange={(e) => e.target.files?.[0] && uploadDeliverable(e.target.files[0])} />
              )}

              {validationUrl && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Link de validação do cliente</Label>
                  <div className="flex gap-2">
                    <Input value={validationUrl} readOnly className="text-xs" />
                    <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(validationUrl); toast.success("Copiado"); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {project.client_decision && canSee("client_decision") && (
                    <p className="text-xs mt-1">
                      Decisão do cliente: <strong>{project.client_decision}</strong>
                      {project.client_feedback && <> — "{project.client_feedback}"</>}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <ProjectChat projectId={project.id} />

          {isManager && (
            <DialogFooter>
              <Button variant="ghost" className="text-destructive" onClick={() => { if (confirm("Remover demanda?")) remove.mutate(); }}>
                <Trash2 className="h-4 w-4 mr-1" /> Remover demanda
              </Button>
            </DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><Label className="text-xs text-muted-foreground">{label}</Label><p className="mt-0.5 font-medium">{value}</p></div>;
}
