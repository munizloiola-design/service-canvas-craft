import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MENU_REGISTRY, deriveFieldRegistry, sectionKey, sectionsForMenu } from "@/lib/access-registry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel as SelSelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Settings, Trash2, Pencil, X } from "lucide-react";
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

      <Tabs defaultValue={search.tab === "assign" ? "assign" : "hierarchy"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="hierarchy">Áreas & Especialidades</TabsTrigger>
          <TabsTrigger value="assign">Atribuição de usuários</TabsTrigger>
        </TabsList>

        <TabsContent value="hierarchy"><HierarchyTab /></TabsContent>
        <TabsContent value="assign"><AssignTab focusUserId={search.user} /></TabsContent>
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
      {fieldSpecId && activeArea && (
        <FieldVisibilityDialog specialtyId={fieldSpecId} areaId={activeArea} onClose={() => setFieldSpecId(null)} />
      )}
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
  const [search, setSearch] = useState("");
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

  const bulk = useMutation({
    mutationFn: async (on: boolean) => {
      if (on) {
        const missing = MENU_REGISTRY.filter((m) => !enabled.has(m.key)).map((m) => ({ area_id: areaId, menu_key: m.key }));
        if (missing.length === 0) return;
        const { error } = await supabase.from("area_menu_visibility").insert(missing);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("area_menu_visibility").delete().eq("area_id", areaId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["area_menu_visibility", areaId] }),
    onError: (e: unknown) => { console.error("[acessos]", e); toast.error(describeSupabaseError(e)); },
  });

  const term = search.trim().toLowerCase();
  const visibleMenus = MENU_REGISTRY.filter(
    (m) => !term || m.label.toLowerCase().includes(term) || m.key.toLowerCase().includes(term),
  );
  const grouped = visibleMenus.reduce<Record<string, typeof MENU_REGISTRY>>((acc, m) => {
    const g = m.group ?? "Geral";
    (acc[g] ??= []).push(m);
    return acc;
  }, {});
  const pending = MENU_REGISTRY.filter((m) => !enabled.has(m.key));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Menus visíveis para esta Área</DialogTitle></DialogHeader>
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select value="" onValueChange={(v) => toggle.mutate({ key: v, on: true })}>
                <SelectTrigger className="h-8 flex-1 min-w-48 text-xs">
                  <SelectValue placeholder={pending.length ? `Liberar menu (${pending.length} disponíveis)` : "Todos os menus liberados"} />
                </SelectTrigger>
                <SelectContent>
                  {pending.map((m) => (
                    <SelectItem key={m.key} value={m.key}>{m.group ? `${m.group} › ` : ""}{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => bulk.mutate(true)}>Liberar todos</Button>
              <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => bulk.mutate(false)}>Bloquear todos</Button>
            </div>
            <Input placeholder="Buscar menu…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-sm" />
            <p className="text-xs text-muted-foreground">
              {enabled.size} de {MENU_REGISTRY.length} menus liberados. Novos menus do sistema aparecem aqui automaticamente, sempre bloqueados até serem liberados.
            </p>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {Object.entries(grouped).map(([group, items]) => (
                <div key={group}>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{group}</p>
                  <div className="space-y-1">
                    {items.map((m) => (
                      <label key={m.key} className="flex items-center gap-2 rounded-md hover:bg-accent px-2 py-1.5 cursor-pointer">
                        <Checkbox checked={enabled.has(m.key)} onCheckedChange={(v) => toggle.mutate({ key: m.key, on: !!v })} />
                        <span className="text-sm flex-1">{m.label}</span>
                        <span className="text-[10px] text-muted-foreground">{m.key}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {visibleMenus.length === 0 && <p className="text-sm text-muted-foreground">Nenhum menu encontrado.</p>}
            </div>
          </div>
        )}
        <DialogFooter><Button onClick={onClose}>Concluir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldVisibilityDialog({ specialtyId, areaId, onClose }: { specialtyId: string; areaId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState<string>("");

  // Menus liberados para a Área desta Especialidade
  const { data: allowedMenus = [] } = useQuery({
    queryKey: ["area_menu_visibility", areaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("area_menu_visibility").select("menu_key").eq("area_id", areaId);
      if (error) throw error;
      return (data ?? []).map((r) => r.menu_key as string);
    },
  });
  const allowedSet = useMemo(() => new Set(allowedMenus), [allowedMenus]);
  const menuGroups = useMemo(() => menuHierarchy(allowedSet), [allowedSet]);
  const firstAllowed = useMemo(
    () => menuGroups.flatMap((g) => g.items).find((n) => n.selectable)?.entry.key ?? "",
    [menuGroups],
  );
  useEffect(() => {
    if (!menu || !allowedSet.has(menu)) setMenu(firstAllowed);
  }, [firstAllowed, allowedSet, menu]);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["specialty_field_visibility", specialtyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("specialty_field_visibility").select("*").eq("specialty_id", specialtyId);
      if (error) throw error;
      return (data ?? []) as { field_key: string; can_view: boolean; can_edit: boolean }[];
    },
  });
  // Colunas reais da tabela de demandas: campos novos entram automaticamente.
  const { data: projectColumns = [] } = useQuery({
    queryKey: ["projects-columns"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").limit(1);
      return data && data[0] ? Object.keys(data[0]) : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Itens do menu selecionado: seções (abas) + campos da demanda quando /projects.
  const items = useMemo(() => {
    const secs = sectionsForMenu(menu).map((s) => ({
      key: sectionKey(menu, s.id),
      label: s.label,
      kind: "Seção" as const,
    }));
    if (menu !== "/projects") return secs;
    return [
      ...secs,
      ...deriveFieldRegistry(projectColumns).map((f) => ({ key: f.key, label: f.label, kind: "Campo" as const })),
    ];
  }, [menu, projectColumns]);

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

  const bulk = useMutation({
    mutationFn: async (on: boolean) => {
      const payload = items.map((f) => ({ specialty_id: specialtyId, field_key: f.key, can_view: on, can_edit: on }));
      const { error } = await supabase.from("specialty_field_visibility").upsert(payload, { onConflict: "specialty_id,field_key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["specialty_field_visibility", specialtyId] }),
    onError: (e: unknown) => { console.error("[acessos]", e); toast.error(describeSupabaseError(e)); },
  });

  const term = search.trim().toLowerCase();
  const visibleItems = items.filter((f) => !term || f.label.toLowerCase().includes(term) || f.key.toLowerCase().includes(term));
  const undecided = items.filter((f) => !map.has(f.key));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>O que esta Especialidade pode ver em cada menu</DialogTitle>
        </DialogHeader>
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Menu</label>
              <Select value={menu} onValueChange={(v) => { setMenu(v); setSearch(""); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MENU_REGISTRY.map((m) => (
                    <SelectItem key={m.key} value={m.key}>{m.group ? `${m.group} › ` : ""}{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted-foreground flex-1 min-w-40">
                {items.length - undecided.length} de {items.length} itens configurados neste menu.
              </p>
              <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => bulk.mutate(true)}>Liberar tudo deste menu</Button>
              <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => bulk.mutate(false)}>Bloquear tudo</Button>
            </div>
            <Input placeholder="Buscar item…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-sm" />
            <div className="max-h-[50vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b">
                  <tr><th className="text-left py-2">Item</th><th className="w-20 text-center">Ver</th><th className="w-20 text-center">Editar</th></tr>
                </thead>
                <tbody>
                  {visibleItems.map((f) => {
                    const cur = map.get(f.key);
                    const canView = cur ? cur.can_view : false;
                    const canEdit = cur ? cur.can_edit : false;
                    return (
                      <tr key={f.key} className="border-b last:border-0">
                        <td className="py-2">
                          <span className="text-[10px] uppercase text-muted-foreground mr-2">{f.kind}</span>
                          {f.label}
                          {!cur && <Badge variant="secondary" className="ml-2 text-[10px]">Novo</Badge>}
                        </td>
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
              {visibleItems.length === 0 && <p className="text-sm text-muted-foreground py-2">Nenhum item encontrado.</p>}
            </div>
          </div>
        )}
        <DialogFooter><Button onClick={onClose}>Concluir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



function AssignTab({ focusUserId }: { focusUserId?: string }) {
  const qc = useQueryClient();
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

  if (members.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhum membro interno encontrado.</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Atribuir cargos aos usuários</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {members.map((m) => {
          const mine = userSpecs.filter((u) => u.user_id === m.id).map((u) => u.specialty_id);
          const mineSet = new Set(mine);
          const memberRoles = allUserRoles.filter((r) => r.user_id === m.id).map((r) => r.role);
          const primaryRole: AppRole = memberRoles[0] ?? "membro";
          const targetRank = Math.max(-1, ...memberRoles.map((r) => ROLE_RANK[r] ?? -1));
          const canManageRole = isMaster || actorRank > targetRank;
          const allowedRoles = isMaster ? ASSIGNABLE_ROLES : ASSIGNABLE_ROLES.filter((r) => ROLE_RANK[r] < actorRank);
          return (
            <div key={m.id} id={`assign-member-${m.id}`} className="border rounded-md p-3 space-y-3 transition-shadow">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{m.full_name ?? m.id}</p>
                  <Badge variant="outline" className="text-[10px] uppercase">{ROLE_LABELS[primaryRole]}</Badge>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {mine.length === 0 && <span className="text-xs text-muted-foreground">Sem cargos atribuídos</span>}
                  {mine.map((sid) => {
                    const s = specs.find((x) => x.id === sid);
                    if (!s) return null;
                    const a = areaOf(sid);
                    return (
                      <Badge key={sid} variant="secondary" className="gap-1">
                        {a?.name ? `${a.name} · ` : ""}{s.name}
                        <button
                          type="button"
                          className="ml-1 opacity-70 hover:opacity-100"
                          onClick={() => unassign.mutate({ userId: m.id, specId: sid })}
                          title="Remover cargo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Papel principal:</Label>
                  <Select
                    value={primaryRole}
                    onValueChange={(v) => setRole.mutate({ userId: m.id, role: v as AppRole })}
                    disabled={!canManageRole || allowedRoles.length === 0}
                  >
                    <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {allowedRoles.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Adicionar cargo:</Label>
                  <Select
                    value=""
                    onValueChange={(val) => { if (val) assign.mutate({ userId: m.id, specId: val }); }}
                  >
                    <SelectTrigger className="max-w-sm">
                      <SelectValue placeholder="Selecionar subfunção…" />
                    </SelectTrigger>
                    <SelectContent>
                      {specsByArea.map(({ area, specs: aSpecs }) => {
                        const available = aSpecs.filter((s) => !mineSet.has(s.id));
                        if (available.length === 0) return null;
                        return (
                          <SelectGroup key={area.id}>
                            <SelSelectLabel>{area.name}</SelSelectLabel>
                            {available.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectGroup>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          );
        })}

      </CardContent>
    </Card>
  );
}

