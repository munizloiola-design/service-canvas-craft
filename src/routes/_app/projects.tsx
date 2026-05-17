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
import { Plus, Calendar, Trash2, Paperclip, Link as LinkIcon, Eye, Download, Copy, X, Columns3, Upload, Filter, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useFieldVisibility } from "@/lib/field-visibility";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";

export const Route = createFileRoute("/_app/projects")({
  component: ProjectsPage,
  validateSearch: (s: Record<string, unknown>) => ({
    detail: typeof s.detail === "string" ? s.detail : undefined,
  }),
});

type Project = {
  id: string; title: string; description: string | null; notes: string | null;
  client_id: string | null; client_name: string | null;
  media_type_id: string | null; status_id: string | null; priority_id: string | null;
  start_date: string | null; due_date: string | null; post_date: string | null;
  has_reference: boolean; reference_links: string[];
  budget: number | null; deliverable_path: string | null;
  client_token: string | null; client_decision: string | null; client_feedback: string | null;
  created_at: string;
};
type Client = { id: string; name: string };
type MediaType = { id: string; name: string };
type Status = { id: string; name: string; color: string; sort_order: number };
type Priority = { id: string; name: string; color: string; level: number };
type Role = { id: string; name: string };
type Profile = { id: string; full_name: string };
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

type FilterKey = "client" | "assignee" | "status" | "priority" | "media" | "decision" | "due_from" | "due_to" | "post_from" | "post_to";
type ActiveFilter = { key: FilterKey; value: string };

const FILTER_LABELS: Record<FilterKey, string> = {
  client: "Cliente", assignee: "Responsável", status: "Etapa", priority: "Prioridade",
  media: "Tipo de mídia", decision: "Decisão do cliente",
  due_from: "Prazo a partir de", due_to: "Prazo até",
  post_from: "Postagem a partir de", post_to: "Postagem até",
};

function ProjectsPage() {
  const { isManager } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = useState<string[]>(ALL_COLUMNS.map((c) => c.key));
  const [filters, setFilters] = useState<ActiveFilter[]>([]);

  useEffect(() => {
    if (search.detail) setDetailId(search.detail);
  }, [search.detail]);

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
    queryKey: ["profiles"], queryFn: async () => (await supabase.from("profiles").select("id, full_name").order("full_name")).data as Profile[] ?? [],
  });
  const { data: allAssignees = [] } = useQuery({
    queryKey: ["project_assignees"], queryFn: async () => (await supabase.from("project_assignees").select("*")).data as Assignee[] ?? [],
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

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      for (const f of filters) {
        if (!f.value) continue;
        switch (f.key) {
          case "client": if (p.client_id !== f.value) return false; break;
          case "status": if ((p.status_id ?? "") !== f.value) return false; break;
          case "priority": if ((p.priority_id ?? "") !== f.value) return false; break;
          case "media": if ((p.media_type_id ?? "") !== f.value) return false; break;
          case "decision": if ((p.client_decision ?? "pending") !== f.value) return false; break;
          case "assignee": {
            const ass = assigneesByProject.get(p.id) ?? [];
            if (!ass.some((a) => a.user_id === f.value)) return false;
            break;
          }
          case "due_from": if (!p.due_date || p.due_date < f.value) return false; break;
          case "due_to": if (!p.due_date || p.due_date > f.value) return false; break;
          case "post_from": if (!p.post_date || p.post_date < f.value) return false; break;
          case "post_to": if (!p.post_date || p.post_date > f.value) return false; break;
        }
      }
      return true;
    });
  }, [projects, filters, assigneesByProject]);

  const filterOptions: Record<FilterKey, { value: string; label: string }[]> = {
    client: clients.map((c) => ({ value: c.id, label: c.name })),
    assignee: members.map((m) => ({ value: m.id, label: m.full_name })),
    status: statuses.map((s) => ({ value: s.id, label: s.name })),
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
        <div className="flex gap-2">
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
                {ALL_COLUMNS.map((c) => (
                  <DropdownMenuCheckboxItem key={c.key} checked={visibleCols.includes(c.key)}
                    onCheckedChange={(v) => setVisibleCols((cur) => v ? [...cur, c.key] : cur.filter((k) => k !== c.key))}>
                    {c.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {isManager && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingProject(null); }}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova demanda</Button></DialogTrigger>
              <NewDemandDialog
                key={editingProject?.id ?? "new"}
                editProject={editingProject}
                onClose={() => { setOpen(false); setEditingProject(null); }}
                clients={clients} mediaTypes={mediaTypes} statuses={statuses} priorities={priorities}
                roles={roles} members={members}
                existingAssignees={editingProject ? (assigneesByProject.get(editingProject.id) ?? []) : []}
              />
            </Dialog>
          )}
        </div>
      </header>

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
        <TabsList><TabsTrigger value="kanban">Kanban</TabsTrigger><TabsTrigger value="list">Lista</TabsTrigger></TabsList>

        <TabsContent value="kanban" className="mt-4">
          <KanbanView projects={filteredProjects} statuses={statuses} priorities={priorities}
            assigneesByProject={assigneesByProject} maps={maps} onDetail={setDetailId} />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <ListView projects={filteredProjects} visibleCols={visibleCols} maps={maps}
            assigneesByProject={assigneesByProject} onDetail={setDetailId} />
        </TabsContent>
      </Tabs>

      <ProjectDetail
        project={projects.find((p) => p.id === detailId) ?? null}
        statuses={statuses} priorities={priorities} maps={maps}
        assignees={detailId ? (assigneesByProject.get(detailId) ?? []) : []}
        onClose={() => { setDetailId(null); if (search.detail) navigate({ to: "/projects", search: {} }); }}
        onEdit={(p) => { setDetailId(null); setEditingProject(p); setOpen(true); }}
      />
    </div>
  );
}

function KanbanView({ projects, statuses, priorities, assigneesByProject, maps, onDetail }: {
  projects: Project[]; statuses: Status[]; priorities: Priority[];
  assigneesByProject: Map<string, Assignee[]>;
  maps: ReturnType<typeof Object> & Record<string, Map<string, unknown>>;
  onDetail: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { canSee } = useFieldVisibility();
  const updateStatus = useMutation({
    mutationFn: async ({ id, status_id, from }: { id: string; status_id: string; from: string | null }) => {
      const { error } = await supabase.from("projects").update({ status_id }).eq("id", id);
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

  if (statuses.length === 0) {
    return <Card className="p-4 md:p-8 text-center text-sm text-muted-foreground">Crie etapas em <strong>Cadastros → Etapas do fluxo</strong> para usar o kanban.</Card>;
  }

  const cols = [...statuses, { id: "__none__", name: "Sem etapa", color: "#64748b", sort_order: 999 } as Status];

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(cols.length, 5)}, minmax(0, 1fr))` }}>
      {cols.map((col) => {
        const items = projects.filter((p) => (p.status_id ?? "__none__") === col.id);
        return (
          <div key={col.id} className="flex flex-col">
            <div className="rounded-t-lg px-3 py-2 flex items-center justify-between border-l-4" style={{ borderColor: col.color, background: `${col.color}15` }}>
              <h3 className="text-sm font-semibold">{col.name}</h3>
              <span className="text-xs bg-background/80 rounded px-2">{items.length}</span>
            </div>
            <div className="bg-card border border-t-0 rounded-b-lg p-2 space-y-2 min-h-[200px]">
              {items.map((p) => {
                const pr = p.priority_id ? (maps.priority.get(p.priority_id) as Priority | undefined) : null;
                const ass = assigneesByProject.get(p.id) ?? [];
                return (
                  <Card key={p.id} className="p-2.5 hover:shadow-md cursor-pointer" onClick={() => onDetail(p.id)}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-medium text-sm leading-snug">{p.title}</h4>
                      {pr && canSee("priority") && <Badge className="border-0 text-[10px] shrink-0" style={{ background: `${pr.color}25`, color: pr.color }}>{pr.name}</Badge>}
                    </div>
                    {p.client_id && canSee("client_id") && <p className="text-xs text-muted-foreground">{maps.client.get(p.client_id) as string}</p>}
                    {p.media_type_id && canSee("media_type") && <span className="inline-block text-[10px] bg-secondary px-1.5 py-0.5 rounded mt-1">{maps.media.get(p.media_type_id) as string}</span>}
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground mt-2">
                      {p.due_date && canSee("due_date") && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(p.due_date).toLocaleDateString("pt-BR")}</span>}
                      {ass.length > 0 && <span>{ass.length} resp.</span>}
                    </div>
                    <Select value={p.status_id ?? ""} onValueChange={(v) => updateStatus.mutate({ id: p.id, status_id: v, from: p.status_id })}>
                      <SelectTrigger className="h-6 text-[11px] mt-2" onClick={(e) => e.stopPropagation()}><SelectValue placeholder="Mover para..." /></SelectTrigger>
                      <SelectContent>{statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </Card>
                );
              })}
              {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Vazio</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ projects, visibleCols, maps, assigneesByProject, onDetail }: {
  projects: Project[]; visibleCols: string[];
  maps: ReturnType<typeof Object> & Record<string, Map<string, unknown>>;
  assigneesByProject: Map<string, Assignee[]>;
  onDetail: (id: string) => void;
}) {
  const { canSee } = useFieldVisibility();
  const colKeyToField: Record<string, string | null> = {
    client: "client_id", media: "media_type", priority: "priority",
    due_date: "due_date", post_date: "post_date",
  };
  const allowedCols = visibleCols.filter((k) => {
    const f = colKeyToField[k]; return !f || canSee(f as never);
  });
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 border-b">
          <tr>
            {ALL_COLUMNS.filter((c) => allowedCols.includes(c.key)).map((c) => (
              <th key={c.key} className="text-left px-3 py-2 font-medium text-xs uppercase text-muted-foreground">{c.label}</th>
            ))}
            <th className="w-12"></th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
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
                <td className="px-2"><Button variant="ghost" size="sm" onClick={() => onDetail(p.id)}><Eye className="h-3.5 w-3.5" /></Button></td>
              </tr>
            );
          })}
          {projects.length === 0 && <tr><td colSpan={allowedCols.length + 1} className="text-center py-8 text-muted-foreground text-sm">Nenhuma demanda</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

function NewDemandDialog({ onClose, clients, mediaTypes, statuses, priorities, roles, members, editProject, existingAssignees }: {
  onClose: () => void;
  clients: Client[]; mediaTypes: MediaType[]; statuses: Status[]; priorities: Priority[];
  roles: Role[]; members: Profile[];
  editProject?: Project | null;
  existingAssignees?: Assignee[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
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
  const [hasRef, setHasRef] = useState(!!editProject?.has_reference);

  const { data: existingAttachments = [] } = useQuery({
    queryKey: ["attachments", editProject?.id, "edit"],
    enabled: isEdit,
    queryFn: async () => (await supabase.from("project_attachments").select("*").eq("project_id", editProject!.id)).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const fd = new FormData(form);
      const base = {
        title: String(fd.get("title")),
        description: String(fd.get("description") || "") || null,
        notes: String(fd.get("notes") || "") || null,
        client_id: (fd.get("client_id") as string) || null,
        media_type_id: (fd.get("media_type_id") as string) || null,
        status_id: (fd.get("status_id") as string) || null,
        priority_id: (fd.get("priority_id") as string) || null,
        start_date: (fd.get("start_date") as string) || null,
        due_date: (fd.get("due_date") as string) || null,
        post_date: (fd.get("post_date") as string) || null,
        has_reference: hasRef,
        reference_links: refLinks.map((s) => s.trim()).filter(Boolean),
        budget: fd.get("budget") ? Number(fd.get("budget")) : null,
      };

      let projectId: string;
      if (isEdit) {
        const { error } = await supabase.from("projects").update(base).eq("id", editProject!.id);
        if (error) throw error;
        projectId = editProject!.id;
        await supabase.from("project_assignees").delete().eq("project_id", projectId);
      } else {
        const { data, error } = await supabase.from("projects").insert({
          ...base,
          client_token: crypto.randomUUID().replace(/-/g, ""),
          created_by: user?.id,
        }).select("id").single();
        if (error) throw error;
        projectId = data.id;
      }

      const validAssignees = assignees.filter((a) => a.user_id);
      if (validAssignees.length) {
        await supabase.from("project_assignees").insert(
          validAssignees.map((a) => ({ project_id: projectId, user_id: a.user_id, role_id: a.role_id || null }))
        );
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
          <Field label="Empresa / Cliente"><Select name="client_id" defaultValue={editProject?.client_id ?? undefined}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Tipo de mídia"><Select name="media_type_id" defaultValue={editProject?.media_type_id ?? undefined}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{mediaTypes.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Etapa"><Select name="status_id" defaultValue={editProject?.status_id ?? statuses[0]?.id}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Prioridade"><Select name="priority_id" defaultValue={editProject?.priority_id ?? undefined}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{priorities.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Início"><Input name="start_date" type="date" defaultValue={editProject?.start_date ?? ""} /></Field>
          <Field label="Prazo"><Input name="due_date" type="date" defaultValue={editProject?.due_date ?? ""} /></Field>
          <Field label="Postagem"><Input name="post_date" type="date" defaultValue={editProject?.post_date ?? ""} /></Field>
        </div>

        <Field label="Valor (R$)"><Input name="budget" type="number" step="0.01" defaultValue={editProject?.budget ?? ""} /></Field>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Responsáveis</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setAssignees((a) => [...a, { user_id: "", role_id: "" }])}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          </div>
          {assignees.map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Select value={a.user_id} onValueChange={(v) => setAssignees((cur) => cur.map((x, j) => j === i ? { ...x, user_id: v } : x))}>
                <SelectTrigger><SelectValue placeholder="Pessoa" /></SelectTrigger>
                <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name || "Sem nome"}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={a.role_id} onValueChange={(v) => setAssignees((cur) => cur.map((x, j) => j === i ? { ...x, role_id: v } : x))}>
                <SelectTrigger><SelectValue placeholder="Função" /></SelectTrigger>
                <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAssignees((cur) => cur.filter((_, j) => j !== i))}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

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

        <Field label="Briefing / Descrição"><Textarea name="description" rows={3} defaultValue={editProject?.description ?? ""} /></Field>
        <Field label="Observações internas"><Textarea name="notes" rows={2} defaultValue={editProject?.notes ?? ""} /></Field>

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
          <Label>{isEdit ? "Adicionar novos anexos" : "Anexos de referência"}</Label>
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
  const { canSee } = useFieldVisibility();

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

  const uploadDeliverable = async (file: File) => {
    if (!project) return;
    const path = `${project.id}/deliverable_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const up = await supabase.storage.from("project-files").upload(path, file);
    if (up.error) { toast.error(up.error.message); return; }
    updateField.mutate({ deliverable_path: path });
  };

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
          {isManager && (
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
            <Info label="Início" value={project.start_date ? new Date(project.start_date).toLocaleDateString("pt-BR") : "—"} />
            {canSee("due_date") && <Info label="Prazo" value={project.due_date ? new Date(project.due_date).toLocaleDateString("pt-BR") : "—"} />}
            {canSee("post_date") && <Info label="Postagem" value={project.post_date ? new Date(project.post_date).toLocaleDateString("pt-BR") : "—"} />}
            {pr && canSee("priority") && <Info label="Prioridade atual" value={pr.name} />}
          </div>

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

          {project.description && canSee("description") && <div><Label className="text-xs text-muted-foreground">Descrição</Label><p className="mt-1 whitespace-pre-wrap">{project.description}</p></div>}
          {project.notes && canSee("notes") && <div><Label className="text-xs text-muted-foreground">Observações</Label><p className="mt-1 whitespace-pre-wrap">{project.notes}</p></div>}

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
                    <Button variant="ghost" size="sm" onClick={() => downloadFile(a.file_path)}><Download className="h-3.5 w-3.5" /></Button>
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
                  <Button variant="outline" size="sm" onClick={() => downloadFile(project.deliverable_path!)}><Download className="h-3.5 w-3.5 mr-1" /> Baixar</Button>
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
                  {project.client_decision && canSee("client_feedback") && (
                    <p className="text-xs mt-1">
                      Decisão do cliente: <strong>{project.client_decision}</strong>
                      {project.client_feedback && <> — "{project.client_feedback}"</>}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

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
