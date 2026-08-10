import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { PermissionTree } from "@/components/PermissionTree";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { describeSupabaseError } from "@/lib/supabase-error";

export const Route = createFileRoute("/_app/acessos")({
  head: () => ({ meta: [{ title: "Perfis e Acessos" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    tab: (s.tab as string) || undefined,
    user: (s.user as string) || undefined,
  }),
  component: AcessosPage,
});

type Area = { id: string; name: string; sort_order: number };
type Specialty = { id: string; area_id: string; name: string; sort_order: number };
type MemberProfile = { id: string; full_name: string | null };
type AppRole = "admin" | "gerente" | "membro" | "cliente";

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  membro: "Colaborador",
  cliente: "Cliente",
};
const ASSIGNABLE_ROLES: AppRole[] = ["admin", "gerente", "membro"];
const ROLE_RANK: Record<AppRole, number> = { admin: 3, gerente: 2, membro: 1, cliente: 0 };
const ROLE_HINTS: Record<AppRole, string> = {
  admin: "Acesso total — ignora as permissões por função.",
  gerente: "Vê todas as demandas e relatórios da agência.",
  membro: "Vê apenas o que a função dele libera.",
  cliente: "Acesso restrito ao portal do cliente.",
};



function AcessosPage() {
  const { isMaster, roles } = useAuth();
  const isAdmin = isMaster || roles.includes("admin" as any);
  const search = Route.useSearch();
  if (!isAdmin) return <Navigate to="/dashboard" />;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Perfis e Acessos</h1>
        <p className="text-sm text-muted-foreground">Configure as Áreas de atuação, Especialidades e o que cada uma enxerga no sistema.</p>
      </div>

      <Tabs defaultValue={search.tab === "assign" ? "assign" : search.tab === "hierarchy" ? "hierarchy" : "perms"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="perms">Permissões</TabsTrigger>
          <TabsTrigger value="hierarchy">Áreas & Especialidades</TabsTrigger>
          <TabsTrigger value="assign">Usuários</TabsTrigger>
        </TabsList>

        <TabsContent value="perms"><PermissionsTab /></TabsContent>
        <TabsContent value="hierarchy"><HierarchyTab /></TabsContent>
        <TabsContent value="assign"><AssignTab focusUserId={search.user} /></TabsContent>
      </Tabs>
    </div>
  );
}


function PermissionsTab() {
  const [areaId, setAreaId] = useState<string>("");
  const [specId, setSpecId] = useState<string>("");

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ["provider_areas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provider_areas").select("*").order("sort_order").order("name");
      if (error) throw error;
      return (data ?? []) as Area[];
    },
  });
  const { data: specs = [] } = useQuery<Specialty[]>({
    queryKey: ["provider_specialties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provider_specialties").select("*").order("sort_order").order("name");
      if (error) throw error;
      return (data ?? []) as Specialty[];
    },
  });

  const activeArea = areaId || areas[0]?.id || "";
  const areaSpecs = specs.filter((s) => s.area_id === activeArea);
  const activeSpec = areaSpecs.some((s) => s.id === specId) ? specId : (areaSpecs[0]?.id ?? "");

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="text-base">Permissões</CardTitle>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Área (libera os menus)</Label>
            <Select value={activeArea} onValueChange={(v) => { setAreaId(v); setSpecId(""); }}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione uma área" /></SelectTrigger>
              <SelectContent>
                {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Especialidade (o que vê dentro de cada menu)</Label>
            <Select value={activeSpec} onValueChange={setSpecId} disabled={areaSpecs.length === 0}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={areaSpecs.length ? "Selecione uma especialidade" : "Nenhuma especialidade nesta área"} />
              </SelectTrigger>
              <SelectContent>
                {areaSpecs.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {activeArea ? (
          <PermissionTree key={activeArea + activeSpec} areaId={activeArea} specialtyId={activeSpec || null} />
        ) : (
          <p className="text-sm text-muted-foreground">Cadastre uma área em “Áreas & Especialidades”.</p>
        )}
      </CardContent>
    </Card>
  );
}

function HierarchyTab() {
  const qc = useQueryClient();
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ type: "area" | "spec"; id: string; name: string } | null>(null);
  const [newAreaOpen, setNewAreaOpen] = useState(false);
  const [newSpecOpen, setNewSpecOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [newSpecName, setNewSpecName] = useState("");

  const areasQ = useQuery<Area[]>({
    queryKey: ["provider_areas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provider_areas").select("*").order("sort_order").order("name");
      if (error) throw error;
      return (data ?? []) as Area[];
    },
  });
  const areas = areasQ.data ?? [];

  const specsQ = useQuery<Specialty[]>({
    queryKey: ["provider_specialties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provider_specialties").select("*").order("sort_order").order("name");
      if (error) throw error;
      return (data ?? []) as Specialty[];
    },
  });
  const specs = specsQ.data ?? [];

  useEffect(() => {
    if (areasQ.error) { console.error("[acessos:areas]", areasQ.error); toast.error("Falha ao carregar áreas: " + describeSupabaseError(areasQ.error)); }
  }, [areasQ.error]);
  useEffect(() => {
    if (specsQ.error) { console.error("[acessos:specs]", specsQ.error); toast.error("Falha ao carregar especialidades: " + describeSupabaseError(specsQ.error)); }
  }, [specsQ.error]);

  const activeArea = selectedArea ?? areas[0]?.id ?? null;
  const areaSpecs = specs.filter((s) => s.area_id === activeArea);

  const createArea = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("provider_areas").insert({ name });
      if (error) throw error;
    },
    onSuccess: () => { setNewAreaName(""); setNewAreaOpen(false); qc.invalidateQueries({ queryKey: ["provider_areas"] }); toast.success("Área criada"); },
    onError: (e: unknown) => { console.error("[acessos]", e); toast.error(describeSupabaseError(e)); },
  });

  const deleteArea = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("provider_areas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["provider_areas"] }); toast.success("Área excluída"); setSelectedArea(null); },
    onError: (e: unknown) => { console.error("[acessos:delete]", e); toast.error("Não foi possível excluir: " + describeSupabaseError(e)); },
  });

  const createSpec = useMutation({
    mutationFn: async ({ areaId, name }: { areaId: string; name: string }) => {
      const { error } = await supabase.from("provider_specialties").insert({ area_id: areaId, name });
      if (error) throw error;
    },
    onSuccess: () => { setNewSpecName(""); setNewSpecOpen(false); qc.invalidateQueries({ queryKey: ["provider_specialties"] }); toast.success("Especialidade criada"); },
    onError: (e: unknown) => { console.error("[acessos]", e); toast.error(describeSupabaseError(e)); },
  });

  const deleteSpec = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("provider_specialties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["provider_specialties"] }); toast.success("Especialidade excluída"); },
    onError: (e: unknown) => { console.error("[acessos]", e); toast.error(describeSupabaseError(e)); },
  });

  const rename = useMutation({
    mutationFn: async ({ type, id, name }: { type: "area" | "spec"; id: string; name: string }) => {
      const table = type === "area" ? "provider_areas" : "provider_specialties";
      const { error } = await supabase.from(table).update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: [v.type === "area" ? "provider_areas" : "provider_specialties"] });
      setRenameTarget(null);
      toast.success("Renomeado");
    },
    onError: (e: unknown) => { console.error("[acessos]", e); toast.error(describeSupabaseError(e)); },
  });

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Áreas de Atuação</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Dialog open={newAreaOpen} onOpenChange={setNewAreaOpen}>
            <DialogTrigger asChild>
              <Button className="w-full"><Plus className="h-4 w-4 mr-1" /> Nova área</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova área de atuação</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input
                  autoFocus
                  placeholder="Ex.: Arte"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newAreaName.trim()) createArea.mutate(newAreaName.trim()); }}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setNewAreaOpen(false)}>Cancelar</Button>
                  <Button
                    onClick={() => newAreaName.trim() && createArea.mutate(newAreaName.trim())}
                    disabled={!newAreaName.trim() || createArea.isPending}
                  >
                    {createArea.isPending ? "Salvando..." : "Criar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <div className="space-y-1">
            {areas.map((a) => {
              const active = a.id === activeArea;
              return (
                <div key={a.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 ${active ? "bg-accent" : ""}`}>
                  <button className="flex-1 text-left text-sm font-medium" onClick={() => setSelectedArea(a.id)}>{a.name}</button>
                  <Button variant="ghost" size="icon" title="Renomear" onClick={() => setRenameTarget({ type: "area", id: a.id, name: a.name })}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Excluir" onClick={() => { if (confirm(`Excluir área "${a.name}"?`)) deleteArea.mutate(a.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              );
            })}
            {areas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma área cadastrada.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Especialidades {activeArea && `— ${areas.find((a) => a.id === activeArea)?.name}`}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {activeArea ? (
            <>
              <Dialog open={newSpecOpen} onOpenChange={setNewSpecOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full"><Plus className="h-4 w-4 mr-1" /> Nova especialidade</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nova especialidade</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input
                      autoFocus
                      placeholder="Ex.: Designer"
                      value={newSpecName}
                      onChange={(e) => setNewSpecName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && newSpecName.trim()) createSpec.mutate({ areaId: activeArea, name: newSpecName.trim() }); }}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setNewSpecOpen(false)}>Cancelar</Button>
                      <Button
                        onClick={() => newSpecName.trim() && createSpec.mutate({ areaId: activeArea, name: newSpecName.trim() })}
                        disabled={!newSpecName.trim() || createSpec.isPending}
                      >
                        {createSpec.isPending ? "Salvando..." : "Criar"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <div className="space-y-1">
                {areaSpecs.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <span className="flex-1 text-sm">{s.name}</span>
                    <Button variant="ghost" size="icon" title="Renomear" onClick={() => setRenameTarget({ type: "spec", id: s.id, name: s.name })}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" title="Excluir" onClick={() => { if (confirm(`Excluir especialidade "${s.name}"?`)) deleteSpec.mutate(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {areaSpecs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma especialidade nesta área.</p>}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Selecione uma área.</p>
          )}
        </CardContent>
      </Card>

      {renameTarget && (
        <Dialog open onOpenChange={() => setRenameTarget(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Renomear</DialogTitle></DialogHeader>
            <Input value={renameTarget.name} onChange={(e) => setRenameTarget({ ...renameTarget, name: e.target.value })} />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRenameTarget(null)}>Cancelar</Button>
              <Button onClick={() => rename.mutate(renameTarget)} disabled={rename.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}


function AssignTab({ focusUserId }: { focusUserId?: string }) {
  const qc = useQueryClient();
  const [memberSearch, setMemberSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const { isMaster, roles: actorRoles } = useAuth();
  const actorRank = Math.max(-1, ...actorRoles.map((r) => ROLE_RANK[r as AppRole] ?? -1));

  const rolesQ = useQuery({
    queryKey: ["all_user_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as { user_id: string; role: AppRole }[];
    },
  });
  const allUserRoles = rolesQ.data ?? [];

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const del = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (del.error) throw del.error;
      const ins = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (ins.error) throw ins.error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all_user_roles"] }); toast.success("Papel atualizado"); },
    onError: (e: unknown) => { console.error("[acessos:setRole]", e); toast.error(describeSupabaseError(e)); },
  });

  useEffect(() => {
    if (!focusUserId) return;
    const el = document.getElementById(`assign-member-${focusUserId}`);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("ring-2","ring-primary"); setTimeout(() => el.classList.remove("ring-2","ring-primary"), 2500); }
  }, [focusUserId, rolesQ.data]);


  const membersQ = useQuery<MemberProfile[]>({
    queryKey: ["team-members-for-assign"],
    queryFn: async () => {
      const primary = await supabase.from("internal_profiles").select("id, full_name").order("full_name");
      if (!primary.error) return (primary.data ?? []) as MemberProfile[];
      console.error("[acessos:assign:internal_profiles fallback]", primary.error);
      const fb = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (fb.error) throw fb.error;
      return (fb.data ?? []) as MemberProfile[];
    },
  });
  const members = membersQ.data ?? [];

  const areasQ = useQuery<Area[]>({
    queryKey: ["provider_areas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provider_areas").select("*").order("sort_order").order("name");
      if (error) throw error;
      return (data ?? []) as Area[];
    },
  });
  const areas = areasQ.data ?? [];

  const specsQ = useQuery<Specialty[]>({
    queryKey: ["provider_specialties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provider_specialties").select("*").order("sort_order").order("name");
      if (error) throw error;
      return (data ?? []) as Specialty[];
    },
  });
  const specs = specsQ.data ?? [];

  const userSpecsQ = useQuery({
    queryKey: ["all_user_specialties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_specialties").select("user_id, specialty_id");
      if (error) throw error;
      return (data ?? []) as { user_id: string; specialty_id: string }[];
    },
  });
  const userSpecs = userSpecsQ.data ?? [];

  useEffect(() => {
    for (const [label, q] of [
      ["profiles", membersQ], ["provider_areas", areasQ],
      ["provider_specialties", specsQ], ["user_specialties", userSpecsQ],
    ] as const) {
      if (q.error) { console.error(`[acessos:assign:${label}]`, q.error); toast.error(`Falha em ${label}: ${describeSupabaseError(q.error)}`); }
    }
  }, [membersQ.error, areasQ.error, specsQ.error, userSpecsQ.error]);

  const assign = useMutation({
    mutationFn: async ({ userId, specId }: { userId: string; specId: string }) => {
      try {
        const { error } = await supabase.from("user_specialties").insert({ user_id: userId, specialty_id: specId });
        if (error && !String(error.message).includes("duplicate")) throw error;
      } catch (e) {
        console.error("[acessos:assign:insert]", e);
        throw e;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all_user_specialties"] }); toast.success("Cargo atribuído"); },
    onError: (e: unknown) => { console.error("[acessos:assign:onError]", e); toast.error(describeSupabaseError(e)); },
  });

  const unassign = useMutation({
    mutationFn: async ({ userId, specId }: { userId: string; specId: string }) => {
      try {
        const { error } = await supabase.from("user_specialties").delete().eq("user_id", userId).eq("specialty_id", specId);
        if (error) throw error;
      } catch (e) {
        console.error("[acessos:assign:delete]", e);
        throw e;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all_user_specialties"] }); toast.success("Cargo removido"); },
    onError: (e: unknown) => { console.error("[acessos:assign:onError]", e); toast.error(describeSupabaseError(e)); },
  });

  const areaOf = (specId: string) => {
    const s = specs.find((x) => x.id === specId);
    return areas.find((a) => a.id === s?.area_id);
  };

  const specsByArea = areas.map((a) => ({ area: a, specs: specs.filter((s) => s.area_id === a.id) }));

  if (membersQ.isLoading || areasQ.isLoading || specsQ.isLoading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando…</CardContent></Card>;
  }

  if (areas.length === 0 || specs.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            {areas.length === 0
              ? "Nenhuma Área cadastrada. Crie uma Área na aba anterior antes de atribuir cargos."
              : "Nenhuma Subfunção cadastrada. Crie uma Subfunção dentro de uma Área."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (rolesQ.isError) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3 text-sm">
          <p className="text-destructive font-medium">Não foi possível carregar os papéis dos usuários.</p>
          <p className="text-muted-foreground">
            Sua sessão pode ter expirado. Recarregue a página ou entre novamente — nenhum papel foi alterado.
          </p>
          <Button variant="outline" size="sm" onClick={() => rolesQ.refetch()}>Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  if (members.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhum membro interno encontrado.</CardContent></Card>;
  }


  const term = memberSearch.trim().toLowerCase();
  const roleOf = (id: string): AppRole => (allUserRoles.find((r) => r.user_id === id)?.role ?? "membro");
  const filtered = members.filter((m) => !term || (m.full_name ?? "").toLowerCase().includes(term));
  const sections: { role: AppRole; title: string; hint: string }[] = [
    { role: "admin", title: "Administradores", hint: "Acesso total — não depende de função." },
    { role: "gerente", title: "Gerentes", hint: "Veem todas as demandas e relatórios da agência." },
    { role: "membro", title: "Colaboradores", hint: "Veem apenas o que a função libera." },
  ];

  const MemberCard = ({ m }: { m: MemberProfile }) => {
    const mine = userSpecs.filter((u) => u.user_id === m.id).map((u) => u.specialty_id);
    const mineSet = new Set(mine);
    const memberRoles = allUserRoles.filter((r) => r.user_id === m.id).map((r) => r.role);
    const primaryRole: AppRole = memberRoles[0] ?? "membro";
    const targetRank = Math.max(-1, ...memberRoles.map((r) => ROLE_RANK[r] ?? -1));
    const canManageRole = isMaster || actorRank > targetRank;
    const allowedRoles = isMaster ? ASSIGNABLE_ROLES : ASSIGNABLE_ROLES.filter((r) => ROLE_RANK[r] < actorRank);
    const privileged = primaryRole === "admin" || primaryRole === "gerente";
    const open = expanded.has(m.id);
    const showFunctions = !privileged || open;

    return (
      <div id={`assign-member-${m.id}`} className="border rounded-lg p-3 space-y-2 transition-shadow">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="font-medium">{m.full_name ?? m.id}</p>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Nível de acesso</Label>
            <Select
              value={primaryRole}
              onValueChange={(v) => setRole.mutate({ userId: m.id, role: v as AppRole })}
              disabled={!canManageRole || allowedRoles.length === 0}
            >
              <SelectTrigger className="h-8 w-44 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {allowedRoles.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{ROLE_HINTS[primaryRole]}</p>

        {privileged && !open && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-2"
            onClick={() => setExpanded((p) => new Set(p).add(m.id))}
          >
            Acesso total — não depende de função. Mostrar funções ({mine.length})
          </button>
        )}

        {showFunctions && (
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-xs text-muted-foreground">Função:</Label>
            {mine.length === 0 && !privileged && (
              <span className="text-xs text-destructive">Sem acesso a nenhum menu — escolha uma função.</span>
            )}
            {mine.length === 0 && privileged && (
              <span className="text-xs text-muted-foreground">Nenhuma função.</span>
            )}
            {mine.map((sid) => {
              const s = specs.find((x) => x.id === sid);
              if (!s) return null;
              const a = areaOf(sid);
              return (
                <Badge key={sid} variant="secondary" className="gap-1">
                  {a?.name ? `${a.name} › ` : ""}{s.name}
                  <button
                    type="button"
                    className="ml-1 opacity-70 hover:opacity-100"
                    onClick={() => unassign.mutate({ userId: m.id, specId: sid })}
                    title="Remover função"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
            <Popover open={pickerFor === m.id} onOpenChange={(o) => setPickerFor(o ? m.id : null)}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" /> adicionar função
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-72" align="start">
                <Command>
                  <CommandInput placeholder="Buscar função…" />
                  <CommandList>
                    <CommandEmpty>Nenhuma função disponível.</CommandEmpty>
                    {specsByArea.map(({ area, specs: aSpecs }) => {
                      const available = aSpecs.filter((s) => !mineSet.has(s.id));
                      if (available.length === 0) return null;
                      return (
                        <CommandGroup key={area.id} heading={area.name}>
                          {available.map((s) => (
                            <CommandItem
                              key={s.id}
                              value={`${area.name} ${s.name}`}
                              onSelect={() => { assign.mutate({ userId: m.id, specId: s.id }); setPickerFor(null); }}
                            >
                              {s.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      );
                    })}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="text-base">Usuários</CardTitle>
        <Input
          placeholder="Buscar pessoa…"
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          className="h-9 max-w-sm text-sm"
        />
      </CardHeader>
      <CardContent className="space-y-6">
        {sections.map((sec) => {
          const list = filtered.filter((m) => roleOf(m.id) === sec.role);
          if (list.length === 0) return null;
          return (
            <div key={sec.role} className="space-y-2">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">{sec.title}</p>
                <p className="text-[11px] text-muted-foreground">{sec.hint}</p>
              </div>
              <div className="space-y-2">
                {list.map((m) => <MemberCard key={m.id} m={m} />)}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pessoa encontrada.</p>}
      </CardContent>
    </Card>
  );
}


