import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { permissionTree, type PermItem, type PermMenu } from "@/lib/access-registry";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { describeSupabaseError } from "@/lib/supabase-error";

type Rule = { field_key: string; can_view: boolean; can_edit: boolean };

/**
 * Matriz única de permissões: menus (liberados pela Área) com as abas e
 * campos de cada um (liberados pela Especialidade), tudo em uma árvore.
 */
export function PermissionTree({ areaId, specialtyId }: { areaId: string; specialtyId: string | null }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data: menuRows = [], isLoading: loadingMenus } = useQuery({
    queryKey: ["area_menu_visibility", areaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("area_menu_visibility").select("menu_key").eq("area_id", areaId);
      if (error) throw error;
      return (data ?? []).map((r) => r.menu_key as string);
    },
  });
  const allowedSet = useMemo(() => new Set(menuRows), [menuRows]);

  const { data: rules = [], isLoading: loadingRules } = useQuery({
    queryKey: ["specialty_field_visibility", specialtyId],
    enabled: !!specialtyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("specialty_field_visibility")
        .select("field_key, can_view, can_edit")
        .eq("specialty_id", specialtyId!);
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });
  const ruleMap = useMemo(() => new Map(rules.map((r) => [r.field_key, r])), [rules]);

  const { data: projectColumns = [] } = useQuery({
    queryKey: ["projects-columns"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").limit(1);
      return data && data[0] ? Object.keys(data[0]) : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["workflow_statuses"],
    queryFn: async () =>
      ((await supabase.from("workflow_statuses").select("id, name").order("sort_order")).data ?? []) as { id: string; name: string }[],
  });

  const tree = useMemo(() => permissionTree(allowedSet, projectColumns, stages), [allowedSet, projectColumns, stages]);


  const setMenu = useMutation({
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

  const setItems = useMutation({
    mutationFn: async (payload: { key: string; can_view: boolean; can_edit: boolean }[]) => {
      if (!specialtyId || payload.length === 0) return;
      const { error } = await supabase.from("specialty_field_visibility").upsert(
        payload.map((p) => ({ specialty_id: specialtyId, field_key: p.key, can_view: p.can_view, can_edit: p.can_edit })),
        { onConflict: "specialty_id,field_key" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["specialty_field_visibility", specialtyId] }),
    onError: (e: unknown) => { console.error("[acessos]", e); toast.error(describeSupabaseError(e)); },
  });

  const clearMenuRules = useMutation({
    mutationFn: async (items: PermItem[]) => {
      if (!specialtyId) return;
      const { error } = await supabase
        .from("specialty_field_visibility")
        .delete()
        .eq("specialty_id", specialtyId)
        .in("field_key", items.map((i) => i.key));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["specialty_field_visibility", specialtyId] }),
    onError: (e: unknown) => { console.error("[acessos]", e); toast.error(describeSupabaseError(e)); },
  });

  const term = search.trim().toLowerCase();
  const matches = (m: PermMenu) =>
    !term
      ? m
      : m.entry.label.toLowerCase().includes(term) || m.entry.key.toLowerCase().includes(term)
        ? m
        : { ...m, items: m.items.filter((i) => i.label.toLowerCase().includes(term) || i.key.toLowerCase().includes(term)) };

  const groups = tree
    .map((g) => ({
      group: g.group,
      menus: g.menus.map(matches).filter((m) => !term || m.items.length > 0 || m.entry.label.toLowerCase().includes(term)),
    }))
    .filter((g) => g.menus.length > 0);

  const allMenus = tree.flatMap((g) => g.menus);

  const bulkAll = async (on: boolean) => {
    if (on) {
      const missing = allMenus.filter((m) => !m.areaAllowed).map((m) => ({ area_id: areaId, menu_key: m.entry.key }));
      if (missing.length) {
        const { error } = await supabase.from("area_menu_visibility").insert(missing);
        if (error) { toast.error(describeSupabaseError(error)); return; }
      }
      await setItems.mutateAsync(allMenus.flatMap((m) => m.items.map((i) => ({ key: i.key, can_view: true, can_edit: true }))));
    } else {
      const { error } = await supabase.from("area_menu_visibility").delete().eq("area_id", areaId);
      if (error) { toast.error(describeSupabaseError(error)); return; }
      await setItems.mutateAsync(allMenus.flatMap((m) => m.items.map((i) => ({ key: i.key, can_view: false, can_edit: false }))));
    }
    qc.invalidateQueries({ queryKey: ["area_menu_visibility", areaId] });
    toast.success(on ? "Tudo liberado" : "Tudo bloqueado");
  };

  const toggleMenu = async (m: PermMenu, on: boolean) => {
    await setMenu.mutateAsync({ key: m.entry.key, on });
    if (!specialtyId) return;
    if (on) {
      // Marcar o menu marca abas e campos filhos.
      await setItems.mutateAsync(m.items.map((i) => ({ key: i.key, can_view: true, can_edit: i.kind === "Campo" })));
    } else {
      await setItems.mutateAsync(m.items.map((i) => ({ key: i.key, can_view: false, can_edit: false })));
    }
  };

  if (loadingMenus || (specialtyId && loadingRules)) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  const countAllowed = (m: PermMenu) => m.items.filter((i) => ruleMap.get(i.key)?.can_view).length;
  const hasAnyRule = (m: PermMenu) => m.items.some((i) => ruleMap.has(i.key));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar menu, aba ou campo…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 flex-1 min-w-52 text-sm" />
        <Button size="sm" variant="outline" onClick={() => void bulkAll(true)}>Liberar tudo</Button>
        <Button size="sm" variant="outline" onClick={() => void bulkAll(false)}>Bloquear tudo</Button>
      </div>

      {!specialtyId && (
        <p className="text-xs text-muted-foreground">
          Selecione uma Especialidade para configurar abas e campos. Sem ela, você só libera os menus da Área.
        </p>
      )}

      <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-1">
        {groups.map((g) => (
          <div key={g.group}>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{g.group}</p>
            <div className="space-y-1">
              {g.menus.map((m) => {
                const open = !collapsed.has(m.entry.key) && (!!term || m.areaAllowed);
                return (
                  <div key={m.entry.key} className="rounded-md border" style={{ marginLeft: m.depth * 16 }}>
                    <div className={`flex items-center gap-2 px-2 py-2 ${m.areaAllowed ? "" : "opacity-60"}`}>
                      <button
                        type="button"
                        className="text-muted-foreground"
                        onClick={() => setCollapsed((prev) => {
                          const next = new Set(prev);
                          next.has(m.entry.key) ? next.delete(m.entry.key) : next.add(m.entry.key);
                          return next;
                        })}
                        aria-label={open ? "Recolher" : "Expandir"}
                      >
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <Checkbox checked={m.areaAllowed} onCheckedChange={(v) => void toggleMenu(m, !!v)} />
                      <span className="text-sm font-medium flex-1">{m.entry.label}</span>
                      {m.areaAllowed ? (
                        specialtyId && (
                          <span className="text-[11px] text-muted-foreground">
                            {hasAnyRule(m) ? `${countAllowed(m)} de ${m.items.length} itens liberados` : "Sem regras: tudo visível"}
                          </span>
                        )
                      ) : (
                        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                          <Lock className="h-3 w-3" /> não liberado na Área
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground hidden md:inline">{m.entry.key}</span>
                    </div>

                    {open && specialtyId && (
                      <div className="border-t px-2 py-2 space-y-1">
                        <div className="flex justify-end gap-2 pb-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            disabled={!m.areaAllowed}
                            onClick={() => setItems.mutate(m.items.map((i) => ({ key: i.key, can_view: true, can_edit: i.kind === "Campo" })))}
                          >
                            Liberar tudo deste menu
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => clearMenuRules.mutate(m.items)}
                          >
                            Limpar regras
                          </Button>
                        </div>
                        {m.items.map((i) => {
                          const cur = ruleMap.get(i.key);
                          const canView = cur?.can_view ?? false;
                          const canEdit = cur?.can_edit ?? false;
                          return (
                            <div key={i.key} className="flex items-center gap-2 text-sm rounded hover:bg-accent px-2 py-1">
                              <span className="text-[10px] uppercase text-muted-foreground w-12 shrink-0">{i.kind}</span>
                              <span className="flex-1">
                                {i.label}
                                {!cur && <Badge variant="secondary" className="ml-2 text-[10px]">Novo</Badge>}
                              </span>
                              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Checkbox
                                  disabled={!m.areaAllowed}
                                  checked={canView}
                                  onCheckedChange={(v) => setItems.mutate([{ key: i.key, can_view: !!v, can_edit: !!v && canEdit }])}
                                />
                                Ver
                              </label>
                              {i.kind === "Campo" ? (
                                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Checkbox
                                    disabled={!m.areaAllowed}
                                    checked={canEdit}
                                    onCheckedChange={(v) => setItems.mutate([{ key: i.key, can_view: canView || !!v, can_edit: !!v }])}
                                  />
                                  Editar
                                </label>
                              ) : (
                                <span className="w-12" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {groups.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>}
      </div>
    </div>
  );
}
