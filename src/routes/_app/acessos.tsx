import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MENU_REGISTRY, FIELD_REGISTRY } from "@/lib/access-registry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { describeSupabaseError } from "@/lib/supabase-error";

export const Route = createFileRoute("/_app/acessos")({
  head: () => ({ meta: [{ title: "Perfis e Acessos" }] }),
  component: AcessosPage,
});

type Area = { id: string; name: string; sort_order: number };
type Specialty = { id: string; area_id: string; name: string; sort_order: number };
type MemberProfile = { id: string; full_name: string | null };

function AcessosPage() {
  const { isMaster, roles } = useAuth();
  const isAdmin = isMaster || roles.includes("admin" as any);
  if (!isAdmin) return <Navigate to="/dashboard" />;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Perfis e Acessos</h1>
        <p className="text-sm text-muted-foreground">Configure as Áreas de atuação, Especialidades e o que cada uma enxerga no sistema.</p>
      </div>

      <Tabs defaultValue="hierarchy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="hierarchy">Áreas & Especialidades</TabsTrigger>
          <TabsTrigger value="assign">Atribuição de usuários</TabsTrigger>
        </TabsList>

        <TabsContent value="hierarchy"><HierarchyTab /></TabsContent>
        <TabsContent value="assign"><AssignTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function HierarchyTab() {
  const qc = useQueryClient();
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [menuAreaId, setMenuAreaId] = useState<string | null>(null);
  const [fieldSpecId, setFieldSpecId] = useState<string | null>(null);
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
                  <Button variant="ghost" size="icon" title="Menus" onClick={() => setMenuAreaId(a.id)}><Settings className="h-4 w-4" /></Button>
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
              <div className="flex gap-2">
                <Input placeholder="Ex.: Designer" value={newSpecName} onChange={(e) => setNewSpecName(e.target.value)} />
                <Button onClick={() => newSpecName.trim() && createSpec.mutate({ areaId: activeArea, name: newSpecName.trim() })} disabled={createSpec.isPending}>
                  <Plus className="h-4 w-4 mr-1" /> Nova
                </Button>
              </div>
              <div className="space-y-1">
                {areaSpecs.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <span className="flex-1 text-sm">{s.name}</span>
                    <Button variant="ghost" size="icon" title="Campos" onClick={() => setFieldSpecId(s.id)}><Settings className="h-4 w-4" /></Button>
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

      {menuAreaId && <MenuVisibilityDialog areaId={menuAreaId} onClose={() => setMenuAreaId(null)} />}
      {fieldSpecId && <FieldVisibilityDialog specialtyId={fieldSpecId} onClose={() => setFieldSpecId(null)} />}
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

function MenuVisibilityDialog({ areaId, onClose }: { areaId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["area_menu_visibility", areaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("area_menu_visibility").select("menu_key").eq("area_id", areaId);
      if (error) throw error;
      return (data ?? []) as { menu_key: string }[];
    },
  });
  const enabled = new Set(rows.map((r) => r.menu_key));

  const toggle = useMutation({
    mutationFn: async ({ key, on }: { key: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase.from("area_menu_visibility").insert({ area_id: areaId, menu_key: key });
        if (error && !String(error.message).includes("duplicate")) throw error;
      } else {
        const { error } = await supabase.from("area_menu_visibility").delete().eq("area_id", areaId).eq("menu_key", key);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["area_menu_visibility", areaId] }),
    onError: (e: unknown) => { console.error("[acessos]", e); toast.error(describeSupabaseError(e)); },
  });

  const grouped = MENU_REGISTRY.reduce<Record<string, typeof MENU_REGISTRY>>((acc, m) => {
    const g = m.group ?? "Geral";
    (acc[g] ??= []).push(m);
    return acc;
  }, {});

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Menus visíveis para esta Área</DialogTitle></DialogHeader>
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{group}</p>
                <div className="space-y-1">
                  {items.map((m) => (
                    <label key={m.key} className="flex items-center gap-2 rounded-md hover:bg-accent px-2 py-1.5 cursor-pointer">
                      <Checkbox checked={enabled.has(m.key)} onCheckedChange={(v) => toggle.mutate({ key: m.key, on: !!v })} />
                      <span className="text-sm">{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter><Button onClick={onClose}>Concluir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldVisibilityDialog({ specialtyId, onClose }: { specialtyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["specialty_field_visibility", specialtyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("specialty_field_visibility").select("*").eq("specialty_id", specialtyId);
      if (error) throw error;
      return (data ?? []) as { field_key: string; can_view: boolean; can_edit: boolean }[];
    },
  });
  const map = new Map(rows.map((r) => [r.field_key, r]));

  const upsert = useMutation({
    mutationFn: async ({ key, can_view, can_edit }: { key: string; can_view: boolean; can_edit: boolean }) => {
      const { error } = await supabase.from("specialty_field_visibility")
        .upsert({ specialty_id: specialtyId, field_key: key, can_view, can_edit }, { onConflict: "specialty_id,field_key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["specialty_field_visibility", specialtyId] }),
    onError: (e: unknown) => { console.error("[acessos]", e); toast.error(describeSupabaseError(e)); },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Campos da demanda visíveis para esta Especialidade</DialogTitle></DialogHeader>
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr><th className="text-left py-2">Campo</th><th className="w-20 text-center">Ver</th><th className="w-20 text-center">Editar</th></tr>
              </thead>
              <tbody>
                {FIELD_REGISTRY.map((f) => {
                  const cur = map.get(f.key);
                  const canView = cur ? cur.can_view : true;
                  const canEdit = cur ? cur.can_edit : true;
                  return (
                    <tr key={f.key} className="border-b last:border-0">
                      <td className="py-2">{f.label}</td>
                      <td className="text-center">
                        <Checkbox checked={canView} onCheckedChange={(v) => upsert.mutate({ key: f.key, can_view: !!v, can_edit: !!v && canEdit })} />
                      </td>
                      <td className="text-center">
                        <Checkbox checked={canEdit} onCheckedChange={(v) => upsert.mutate({ key: f.key, can_view: canView || !!v, can_edit: !!v })} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter><Button onClick={onClose}>Concluir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignTab() {
  const qc = useQueryClient();
  const membersQ = useQuery<MemberProfile[]>({
    queryKey: ["team-members-for-assign"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return (data ?? []) as MemberProfile[];
    },
  });
  const members = membersQ.data ?? [];
  const areasQ = useQuery<Area[]>({
    queryKey: ["provider_areas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provider_areas").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Area[];
    },
  });
  const areas = areasQ.data ?? [];
  const specsQ = useQuery<Specialty[]>({
    queryKey: ["provider_specialties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provider_specialties").select("*").order("name");
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

  const toggle = useMutation({
    mutationFn: async ({ userId, specId, on }: { userId: string; specId: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase.from("user_specialties").insert({ user_id: userId, specialty_id: specId });
        if (error && !String(error.message).includes("duplicate")) throw error;
      } else {
        const { error } = await supabase.from("user_specialties").delete().eq("user_id", userId).eq("specialty_id", specId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all_user_specialties"] }),
    onError: (e: unknown) => { console.error("[acessos]", e); toast.error(describeSupabaseError(e)); },
  });

  const areaNameOf = (specId: string) => {
    const s = specs.find((x) => x.id === specId);
    return areas.find((a) => a.id === s?.area_id)?.name ?? "";
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Atribuir especialidades aos usuários</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {members.map((m) => {
          const mine = userSpecs.filter((u) => u.user_id === m.id).map((u) => u.specialty_id);
          return (
            <div key={m.id} className="border rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">{m.full_name ?? m.id}</p>
                <div className="flex gap-1 flex-wrap">
                  {mine.map((sid) => {
                    const s = specs.find((x) => x.id === sid);
                    return s ? <Badge key={sid} variant="secondary">{areaNameOf(sid)} · {s.name}</Badge> : null;
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {specs.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={mine.includes(s.id)} onCheckedChange={(v) => toggle.mutate({ userId: m.id, specId: s.id, on: !!v })} />
                    <span className="truncate"><span className="text-muted-foreground">{areaNameOf(s.id)} ·</span> {s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
        {members.length === 0 && <p className="text-sm text-muted-foreground">Nenhum membro encontrado.</p>}
      </CardContent>
    </Card>
  );
}
