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
import { Plus, Calendar, User as UserIcon, Trash2, Paperclip, Link as LinkIcon, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/projects")({
  component: ProjectsPage,
});

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Status = Database["public"]["Enums"]["project_status"];
type Priority = Database["public"]["Enums"]["project_priority"];
type ServiceType = Database["public"]["Enums"]["service_type"];
type MediaType = Database["public"]["Enums"]["media_type"];
type Attachment = Database["public"]["Tables"]["project_attachments"]["Row"];

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
  baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente",
};

const SERVICE_LABELS: Record<ServiceType, string> = {
  design_grafico: "Design gráfico",
  social_media: "Social Media",
  video: "Vídeo",
  fotografia: "Fotografia",
  web: "Web / Site",
  branding: "Branding",
  copywriting: "Copywriting",
  outro: "Outro",
};

const MEDIA_LABELS: Record<MediaType, string> = {
  post: "Post",
  story: "Story",
  reels: "Reels",
  video: "Vídeo",
  banner: "Banner",
  logo: "Logo",
  site: "Site",
  impresso: "Impresso",
  outro: "Outro",
};

function ProjectsPage() {
  const { isManager, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);

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
      const { data, error } = await supabase.from("projects").insert({ ...payload, created_by: user?.id }).select("id").single();
      if (error) throw error;
      // Upload files
      if (files.length && data && user) {
        for (const file of files) {
          const path = `${data.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const up = await supabase.storage.from("project-files").upload(path, file);
          if (up.error) { toast.error(`Falha ao enviar ${file.name}: ${up.error.message}`); continue; }
          await supabase.from("project_attachments").insert({
            project_id: data.id, file_name: file.name, file_path: path,
            file_size: file.size, mime_type: file.type, uploaded_by: user.id,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto criado");
      setOpen(false);
      setFiles([]);
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
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setFiles([]); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Novo projeto</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Cadastro de serviço / projeto</DialogTitle></DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const assigned = String(fd.get("assigned_to"));
                  const service = String(fd.get("service_type"));
                  const media = String(fd.get("media_type"));
                  const refs = String(fd.get("reference_links") || "")
                    .split("\n").map((s) => s.trim()).filter(Boolean);
                  createProject.mutate({
                    title: String(fd.get("title")),
                    description: String(fd.get("description")) || null,
                    client_name: String(fd.get("client_name")) || null,
                    start_date: String(fd.get("start_date")) || null,
                    due_date: String(fd.get("due_date")) || null,
                    priority: (String(fd.get("priority")) || "media") as Priority,
                    status: "a_fazer",
                    budget: fd.get("budget") ? Number(fd.get("budget")) : null,
                    assigned_to: assigned && assigned !== "none" ? assigned : null,
                    service_type: service && service !== "none" ? (service as ServiceType) : null,
                    media_type: media && media !== "none" ? (media as MediaType) : null,
                    reference_links: refs,
                    notes: String(fd.get("notes")) || null,
                  });
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="title">Título do serviço *</Label>
                  <Input id="title" name="title" required placeholder="Ex.: Campanha de lançamento - Maio" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="client_name">Cliente</Label>
                    <Input id="client_name" name="client_name" />
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
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Tipo de serviço</Label>
                    <Select name="service_type" defaultValue="none">
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {(Object.keys(SERVICE_LABELS) as ServiceType[]).map((s) => (
                          <SelectItem key={s} value={s}>{SERVICE_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de mídia</Label>
                    <Select name="media_type" defaultValue="none">
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {(Object.keys(MEDIA_LABELS) as MediaType[]).map((m) => (
                          <SelectItem key={m} value={m}>{MEDIA_LABELS[m]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Início</Label>
                    <Input id="start_date" name="start_date" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Prazo</Label>
                    <Input id="due_date" name="due_date" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget">Valor (R$)</Label>
                    <Input id="budget" name="budget" type="number" step="0.01" />
                  </div>
                </div>

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
                  <Label htmlFor="description">Descrição do serviço</Label>
                  <Textarea id="description" name="description" rows={3} placeholder="Briefing, objetivos, contexto..." />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reference_links">Referências (uma URL por linha)</Label>
                  <Textarea id="reference_links" name="reference_links" rows={3} placeholder="https://exemplo.com/referencia-1" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observações internas</Label>
                  <Textarea id="notes" name="notes" rows={2} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="files">Anexos</Label>
                  <Input
                    id="files"
                    type="file"
                    multiple
                    onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  />
                  {files.length > 0 && (
                    <ul className="text-xs text-muted-foreground space-y-1 mt-1">
                      {files.map((f, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <Paperclip className="h-3 w-3" /> {f.name} <span className="opacity-60">({(f.size / 1024).toFixed(1)} KB)</span>
                        </li>
                      ))}
                    </ul>
                  )}
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
                      <p className="text-xs text-muted-foreground mb-1">{p.client_name}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {p.service_type && (
                        <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{SERVICE_LABELS[p.service_type]}</span>
                      )}
                      {p.media_type && (
                        <span className="text-[10px] bg-accent/40 px-1.5 py-0.5 rounded">{MEDIA_LABELS[p.media_type]}</span>
                      )}
                    </div>
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
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDetailId(p.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
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

      <ProjectDetail
        project={projects.find((p) => p.id === detailId) ?? null}
        memberName={(id: string | null) => (id ? memberMap.get(id) ?? "—" : "—")}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}

function ProjectDetail({
  project, memberName, onClose,
}: {
  project: Project | null;
  memberName: (id: string | null) => string;
  onClose: () => void;
}) {
  const { data: attachments = [] } = useQuery({
    queryKey: ["attachments", project?.id],
    enabled: !!project?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("project_attachments").select("*").eq("project_id", project!.id);
      if (error) throw error;
      return data as Attachment[];
    },
  });

  const downloadFile = async (a: Attachment) => {
    const { data, error } = await supabase.storage.from("project-files").createSignedUrl(a.file_path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Dialog open={!!project} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {project && (
          <>
            <DialogHeader>
              <DialogTitle>{project.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <Info label="Cliente" value={project.client_name || "—"} />
                <Info label="Responsável" value={memberName(project.assigned_to)} />
                <Info label="Tipo de serviço" value={project.service_type ? SERVICE_LABELS[project.service_type] : "—"} />
                <Info label="Tipo de mídia" value={project.media_type ? MEDIA_LABELS[project.media_type] : "—"} />
                <Info label="Início" value={project.start_date ? new Date(project.start_date).toLocaleDateString("pt-BR") : "—"} />
                <Info label="Prazo" value={project.due_date ? new Date(project.due_date).toLocaleDateString("pt-BR") : "—"} />
                <Info label="Prioridade" value={PRIORITY_LABELS[project.priority]} />
                <Info label="Valor" value={project.budget ? `R$ ${Number(project.budget).toFixed(2)}` : "—"} />
              </div>
              {project.description && (
                <div><Label className="text-xs text-muted-foreground">Descrição</Label><p className="mt-1 whitespace-pre-wrap">{project.description}</p></div>
              )}
              {project.notes && (
                <div><Label className="text-xs text-muted-foreground">Observações</Label><p className="mt-1 whitespace-pre-wrap">{project.notes}</p></div>
              )}
              {project.reference_links?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Referências</Label>
                  <ul className="mt-1 space-y-1">
                    {project.reference_links.map((url, i) => (
                      <li key={i}>
                        <a href={url} target="_blank" rel="noreferrer" className="text-info hover:underline inline-flex items-center gap-1 break-all">
                          <LinkIcon className="h-3 w-3 shrink-0" /> {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Anexos ({attachments.length})</Label>
                {attachments.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">Nenhum anexo</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {attachments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50">
                        <span className="inline-flex items-center gap-2 truncate">
                          <Paperclip className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{a.file_name}</span>
                          {a.file_size && <span className="text-xs text-muted-foreground shrink-0">{(a.file_size / 1024).toFixed(1)} KB</span>}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => downloadFile(a)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
