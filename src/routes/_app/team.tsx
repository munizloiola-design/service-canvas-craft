import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { deleteTeamMember, setUserBanned, listBannedUserIds } from "@/lib/team.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertCircle, Activity, Clock, Hourglass, ShieldAlert, Pencil, Upload, Trash2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_app/team")({ component: TeamPage });

const ROLE_LABELS: Record<AppRole, string> = {
  admin_master: "Admin Master",
  admin: "Administrador",
  gerente: "Gerente",
  membro: "Colaborador",
  cliente: "Cliente",
};

const ROLE_TONES: Record<AppRole, string> = {
  admin_master: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  admin: "bg-primary/15 text-primary border-primary/20",
  gerente: "bg-info/15 text-info border-info/20",
  membro: "bg-muted text-muted-foreground",
  cliente: "bg-accent/15 text-accent-foreground border-accent/20",
};

const ASSIGNABLE_ROLES: AppRole[] = ["admin_master", "admin", "gerente", "membro"];

const ROLE_RANK: Record<AppRole, number> = {
  admin_master: 4, admin: 3, gerente: 2, membro: 1, cliente: 0,
};
const maxRank = (rs: AppRole[]) => rs.reduce((m, r) => Math.max(m, ROLE_RANK[r] ?? -1), -1);

type Profile = {
  id: string;
  full_name: string;
  job_title: string | null;
  phone: string | null;
  birth_date: string | null;
  document: string | null;
  address: string | null;
  emergency_contact: string | null;
  start_date: string | null;
  contract_type: string | null;
  avatar_url: string | null;
};

function TeamPage() {
  const { isMaster, isManager } = useAuth();
  const qc = useQueryClient();
  const [openMember, setOpenMember] = useState<string | null>(null);
  const doDelete = useServerFn(deleteTeamMember);

  const deleteMember = useMutation({
    mutationFn: async (userId: string) => {
      const res = await doDelete({ data: { userId } });
      if (!res.success) throw new Error("Falha ao excluir");
      return res;
    },
    onSuccess: () => {
      toast.success("Membro excluído");
      qc.invalidateQueries({ queryKey: ["team-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data } = useQuery({
    queryKey: ["team-overview"],
    queryFn: async () => {
      const [profilesRes, rolesRes, projectsRes, assigneesRes, statusesRes, transitionsRes, fnsRes, userFnsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("projects").select("id, assigned_to, status_id, due_date, created_at"),
        supabase.from("project_assignees").select("project_id, user_id"),
        supabase.from("workflow_statuses").select("id, name, sort_order, is_final").order("sort_order"),
        supabase.from("project_transitions").select("project_id, to_status_id, created_at").order("created_at"),
        supabase.from("collaborator_functions").select("*").order("sort_order"),
        supabase.from("user_functions").select("user_id, function_id"),
      ]);
      return {
        profiles: (profilesRes.data ?? []) as Profile[],
        roles: rolesRes.data ?? [],
        projects: projectsRes.data ?? [],
        assignees: assigneesRes.data ?? [],
        statuses: statusesRes.data ?? [],
        transitions: transitionsRes.data ?? [],
        functions: fnsRes.data ?? [],
        userFunctions: userFnsRes.data ?? [],
      };
    },
  });

  if (!isManager) {
    return <div className="p-8 text-muted-foreground">Você não tem permissão para ver a equipe.</div>;
  }
  if (!data) return <div className="p-8">Carregando…</div>;

  const initialStatusId = data.statuses[0]?.id ?? null;
  const finalStatusIds = new Set(data.statuses.filter((s) => s.is_final).map((s) => s.id));
  const today = new Date().toISOString().slice(0, 10);

  function getMemberProjects(userId: string) {
    const direct = data!.projects.filter((p) => p.assigned_to === userId);
    const viaAssignees = data!.assignees.filter((a) => a.user_id === userId).map((a) => a.project_id);
    const ids = new Set([...direct.map((p) => p.id), ...viaAssignees]);
    return data!.projects.filter((p) => ids.has(p.id));
  }

  function getMetrics(userId: string) {
    const projects = getMemberProjects(userId);
    const projectIds = new Set(projects.map((p) => p.id));
    let atrasadas = 0, pendentes = 0, ativas = 0;
    for (const p of projects) {
      const isFinal = p.status_id && finalStatusIds.has(p.status_id);
      if (isFinal) continue;
      if (p.due_date && p.due_date < today) atrasadas++;
      else if (p.status_id === initialStatusId) pendentes++;
      else ativas++;
    }

    // Tempo médio por status (em horas) — média sobre todas as etapas dos projetos do membro
    const trans = data!.transitions.filter((t) => projectIds.has(t.project_id));
    const byProject: Record<string, typeof trans> = {};
    for (const t of trans) {
      (byProject[t.project_id] ||= []).push(t);
    }
    const durations: number[] = [];
    for (const list of Object.values(byProject)) {
      for (let i = 1; i < list.length; i++) {
        const a = new Date(list[i - 1].created_at).getTime();
        const b = new Date(list[i].created_at).getTime();
        durations.push((b - a) / 3600000);
      }
    }
    const avgHours = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    return { atrasadas, pendentes, ativas, avgHours };
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Equipe</h1>
        <p className="text-muted-foreground mt-1">Acompanhe a carga e o desempenho da equipe.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.profiles.map((m) => {
          const initials = (m.full_name || "U").slice(0, 2).toUpperCase();
          const memberRoles = data.roles.filter((r) => r.user_id === m.id).map((r) => r.role as AppRole);
          const memberFns = data.userFunctions.filter((u) => u.user_id === m.id).map((u) => u.function_id);
          const fnNames = data.functions.filter((f) => memberFns.includes(f.id)).map((f) => f.name);
          const metrics = getMetrics(m.id);

          return (
            <Card key={m.id} className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-12 w-12">
                    {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{m.full_name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.job_title ?? "—"}</p>
                  </div>
                </div>
                {isMaster && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpenMember(m.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Excluir ${m.full_name || "este membro"} permanentemente?`)) {
                          deleteMember.mutate(m.id);
                        }
                      }}
                      disabled={deleteMember.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                {memberRoles.length > 0 ? memberRoles.map((r) => (
                  <Badge key={r} variant="outline" className={ROLE_TONES[r]}>{ROLE_LABELS[r]}</Badge>
                )) : <Badge variant="outline">Sem papel</Badge>}
              </div>

              {fnNames.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {fnNames.map((n) => <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>)}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-center">
                <Stat icon={AlertCircle} value={metrics.atrasadas} label="Atrasadas" tone="danger" />
                <Stat icon={Activity} value={metrics.ativas} label="Ativas" tone="info" />
                <Stat icon={Hourglass} value={metrics.pendentes} label="Pendentes" tone="warning" />
                <Stat icon={Clock} value={metrics.avgHours >= 24 ? `${(metrics.avgHours / 24).toFixed(1)}d` : `${metrics.avgHours.toFixed(1)}h`} label="Média/etapa" tone="muted" />
              </div>
            </Card>
          );
        })}
      </div>

      {data.profiles.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground">Nenhum membro cadastrado ainda.</Card>
      )}

      {openMember && (
        <MemberDialog
          memberId={openMember}
          onClose={() => setOpenMember(null)}
          profile={data.profiles.find((p) => p.id === openMember)!}
          roles={data.roles.filter((r) => r.user_id === openMember).map((r) => r.role as AppRole)}
          allFunctions={data.functions}
          memberFunctionIds={data.userFunctions.filter((u) => u.user_id === openMember).map((u) => u.function_id)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["team-overview"] })}
        />
      )}
    </div>
  );
}

function Stat({ icon: Icon, value, label, tone }: { icon: React.ElementType; value: number | string; label: string; tone: "danger" | "info" | "warning" | "muted" }) {
  const tones = {
    danger: "text-destructive bg-destructive/10",
    info: "text-info bg-info/10",
    warning: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
    muted: "text-muted-foreground bg-muted/60",
  };
  return (
    <div className={`rounded-md py-2 ${tones[tone]}`}>
      <Icon className="h-3.5 w-3.5 mx-auto mb-0.5 opacity-70" />
      <p className="text-base font-semibold leading-tight">{value}</p>
      <p className="text-[9px] uppercase tracking-wider opacity-80">{label}</p>
    </div>
  );
}

function MemberDialog({
  memberId, onClose, profile, roles, allFunctions, memberFunctionIds, onSaved,
}: {
  memberId: string;
  onClose: () => void;
  profile: Profile;
  roles: AppRole[];
  allFunctions: { id: string; name: string }[];
  memberFunctionIds: string[];
  onSaved: () => void;
}) {
  const { roles: actorRoles, isMaster } = useAuth();
  const actorRank = maxRank(actorRoles);
  const targetRank = maxRank(roles);
  const canManageThisUser = isMaster || actorRank > targetRank;
  const allowedRoles = isMaster ? ASSIGNABLE_ROLES : ASSIGNABLE_ROLES.filter((r) => ROLE_RANK[r] < actorRank);

  const [primaryRole, setPrimaryRole] = useState<AppRole>(roles[0] ?? "membro");
  const [selectedFns, setSelectedFns] = useState<string[]>(memberFunctionIds);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    full_name: profile.full_name ?? "",
    job_title: profile.job_title ?? "",
    phone: profile.phone ?? "",
    birth_date: profile.birth_date ?? "",
    document: profile.document ?? "",
    address: profile.address ?? "",
    emergency_contact: profile.emergency_contact ?? "",
    start_date: profile.start_date ?? "",
    contract_type: profile.contract_type ?? "",
  });

  const { data: noteData } = useQuery({
    queryKey: ["team_private_notes", memberId],
    queryFn: async () => {
      const { data } = await supabase.from("team_private_notes").select("*").eq("user_id", memberId).maybeSingle();
      return data;
    },
  });
  const [note, setNote] = useState("");
  // Set note when loaded
  if (noteData && note === "" && noteData.content) {
    // initialize once
    setNote(noteData.content);
  }

  const saveProfile = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: form.full_name,
        job_title: form.job_title || null,
        phone: form.phone || null,
        birth_date: form.birth_date || null,
        document: form.document || null,
        address: form.address || null,
        emergency_contact: form.emergency_contact || null,
        start_date: form.start_date || null,
        contract_type: form.contract_type || null,
        avatar_url: avatarUrl,
      };
      const { error } = await supabase.from("profiles").update(payload).eq("id", memberId);
      if (error) throw error;

      // role — master can set any role; others only roles below their rank
      if (canManageThisUser && (isMaster || ROLE_RANK[primaryRole] < actorRank)) {
        await supabase.from("user_roles").delete().eq("user_id", memberId);
        await supabase.from("user_roles").insert({ user_id: memberId, role: primaryRole });
      }

      // functions
      await supabase.from("user_functions").delete().eq("user_id", memberId);
      if (selectedFns.length > 0) {
        await supabase.from("user_functions").insert(selectedFns.map((function_id) => ({ user_id: memberId, function_id })));
      }
    },
    onSuccess: () => { toast.success("Salvo"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNote = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase.from("team_private_notes").select("id").eq("user_id", memberId).maybeSingle();
      const { data: userData } = await supabase.auth.getUser();
      if (existing) {
        const { error } = await supabase.from("team_private_notes").update({ content: note, updated_at: new Date().toISOString(), updated_by: userData.user?.id }).eq("user_id", memberId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("team_private_notes").insert({ user_id: memberId, content: note, updated_by: userData.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => toast.success("Anotações salvas"),
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleAvatarUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${memberId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(pub.publicUrl);
      toast.success("Foto carregada. Clique em Salvar para confirmar.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile.full_name || "Membro"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="ficha">
          <TabsList>
            <TabsTrigger value="ficha">Ficha</TabsTrigger>
            <TabsTrigger value="funcoes">Papel & Funções</TabsTrigger>
            <TabsTrigger value="notas"><ShieldAlert className="h-3.5 w-3.5 mr-1" />Anotações privadas</TabsTrigger>
          </TabsList>

          <TabsContent value="ficha" className="space-y-3 mt-4">
            <div className="flex items-center gap-4 p-3 rounded-md border bg-muted/30">
              <Avatar className="h-20 w-20">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={form.full_name} />}
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                  {(form.full_name || "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Label className="text-xs">Foto do membro</Label>
                <div className="flex gap-2 mt-1">
                  <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border bg-background hover:bg-muted cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? "Enviando..." : "Carregar foto"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleAvatarUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {avatarUrl && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAvatarUrl(null)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">PNG ou JPG, até 5MB.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome completo" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
              <Field label="Cargo" value={form.job_title} onChange={(v) => setForm({ ...form, job_title: v })} />
              <Field label="Telefone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Field label="Documento (CPF)" value={form.document} onChange={(v) => setForm({ ...form, document: v })} />
              <Field label="Nascimento" type="date" value={form.birth_date} onChange={(v) => setForm({ ...form, birth_date: v })} />
              <Field label="Início no time" type="date" value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
              <Field label="Tipo de contrato" value={form.contract_type} onChange={(v) => setForm({ ...form, contract_type: v })} />
              <Field label="Contato de emergência" value={form.emergency_contact} onChange={(v) => setForm({ ...form, emergency_contact: v })} />
            </div>
            <div>
              <Label className="text-xs">Endereço</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
            </div>
          </TabsContent>

          <TabsContent value="funcoes" className="space-y-4 mt-4">
            <div>
              <Label className="text-xs">Papel principal</Label>
              <Select value={primaryRole} onValueChange={(v) => setPrimaryRole(v as AppRole)} disabled={!canManageThisUser || allowedRoles.length === 0}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allowedRoles.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
              {!canManageThisUser && (
                <p className="text-[11px] text-muted-foreground mt-1">Você não tem permissão para alterar o papel deste membro (papel igual ou superior ao seu).</p>
              )}
              {canManageThisUser && allowedRoles.length === 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">Seu papel não permite atribuir nenhum nível.</p>
              )}
            </div>
            <div>
              <Label className="text-xs mb-2 block">Subfunções (colaborador)</Label>
              <div className="grid grid-cols-2 gap-2">
                {allFunctions.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={selectedFns.includes(f.id)}
                      onCheckedChange={(v) => {
                        if (v) setSelectedFns([...selectedFns, f.id]);
                        else setSelectedFns(selectedFns.filter((id) => id !== f.id));
                      }}
                    />
                    <span className="text-sm">{f.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notas" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">
              Apenas o Administrador Master pode ver ou editar estas anotações.
            </p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={10}
              placeholder="Avaliações, observações de RH, histórico interno…"
            />
            <Button size="sm" onClick={() => saveNote.mutate()} disabled={saveNote.isPending}>
              Salvar anotações
            </Button>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            Salvar ficha e funções
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
