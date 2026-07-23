import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PROJECT_FIELDS } from "@/lib/field-visibility";
import { toast } from "sonner";
import { describeSupabaseError } from "@/lib/supabase-error";

export const Route = createFileRoute("/_app/permissoes")({ component: PermissoesPage });

const ROLES = [
  { key: "admin", label: "Administrador" },
  { key: "gerente", label: "Gerente" },
  { key: "membro", label: "Colaborador" },
] as const;

const RESOURCES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "projects", label: "Demandas / Projetos" },
  { key: "tickets", label: "Tickets" },
  { key: "calendario", label: "Calendário" },
  { key: "financeiro", label: "Financeiro" },
  { key: "orcamento", label: "Orçamento" },
  { key: "equipamentos", label: "Equipamentos" },
  { key: "team", label: "Equipe" },
  { key: "facebook", label: "Facebook Ads" },
  { key: "diguinho", label: "Diguinho IA" },
  { key: "integracoes", label: "Integrações" },
  { key: "cadastros", label: "Cadastros" },
  { key: "branding", label: "Personalização" },
] as const;

const ACTIONS = ["view", "create", "edit", "delete"] as const;
const ACTION_LABELS: Record<string, string> = {
  view: "Ver", create: "Criar", edit: "Editar", delete: "Excluir",
};

type Area = { id: string; name: string; sort_order: number };
type Specialty = { id: string; area_id: string; name: string; sort_order: number };

function PermissoesPage() {
  const { isMaster } = useAuth();
  const qc = useQueryClient();
  const { refresh } = usePermissions();

  const { data: rows = [], error: rowsError } = useQuery({
    queryKey: ["role_permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("*");
      if (error) throw error;
      return data as { id: string; role: string; resource: string; action: string }[];
    },
  });

  const { data: areas = [], error: areasError } = useQuery<Area[]>({
    queryKey: ["provider_areas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provider_areas").select("*").order("sort_order").order("name");
      if (error) throw error;
      return (data ?? []) as Area[];
    },
  });

  const { data: specs = [], error: specsError } = useQuery<Specialty[]>({
    queryKey: ["provider_specialties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provider_specialties").select("*").order("sort_order").order("name");
      if (error) throw error;
      return (data ?? []) as Specialty[];
    },
  });

  const { data: visibility = [], error: visError } = useQuery({
    queryKey: ["specialty_field_visibility"],
    queryFn: async () => {
      const { data, error } = await supabase.from("specialty_field_visibility").select("*");
      if (error) throw error;
      return data as { specialty_id: string; field_key: string; can_view: boolean; can_edit: boolean }[];
    },
  });

  for (const [label, err] of [["role_permissions", rowsError], ["areas", areasError], ["specialties", specsError], ["visibility", visError]] as const) {
    if (err) console.error(`[permissoes:${label}]`, err);
  }

  const has = (role: string, resource: string, action: string) =>
    rows.some((r) => r.role === role && r.resource === resource && r.action === action);

  const toggle = useMutation({
    mutationFn: async ({ role, resource, action, on }: { role: string; resource: string; action: string; on: boolean }) => {
      try {
        if (on) {
          const { error } = await supabase.from("role_permissions").insert({ role: role as "admin" | "gerente" | "membro", resource, action });
          if (error) throw error;
        } else {
          const { error } = await supabase.from("role_permissions").delete().eq("role", role as "admin" | "gerente" | "membro").eq("resource", resource).eq("action", action);
          if (error) throw error;
        }
      } catch (e) {
        console.error("[permissoes:toggle]", e);
        throw e;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["role_permissions"] });
      await refresh();
    },
    onError: (e: unknown) => {
      console.error("[permissoes:toggle:onError]", e);
      toast.error(describeSupabaseError(e));
    },
  });

  const isVisible = (specialtyId: string, fieldKey: string) => {
    const row = visibility.find((v) => v.specialty_id === specialtyId && v.field_key === fieldKey);
    return row ? row.can_view : true;
  };

  const toggleVisibility = useMutation({
    mutationFn: async ({ specialtyId, fieldKey, canView }: { specialtyId: string; fieldKey: string; canView: boolean }) => {
      try {
        const { error } = await supabase.from("specialty_field_visibility").upsert(
          { specialty_id: specialtyId, field_key: fieldKey, can_view: canView, can_edit: canView },
          { onConflict: "specialty_id,field_key" }
        );
        if (error) throw error;
      } catch (e) {
        console.error("[permissoes:toggleVisibility]", e);
        throw e;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["specialty_field_visibility"] }),
    onError: (e: unknown) => {
      console.error("[permissoes:toggleVisibility:onError]", e);
      toast.error(describeSupabaseError(e));
    },
  });

  if (!isMaster) {
    return <div className="p-4 md:p-8"><p className="text-muted-foreground">Apenas o Administrador Master pode editar permissões.</p></div>;
  }

  const specsByArea = areas.map((a) => ({ area: a, specs: specs.filter((s) => s.area_id === a.id) }));

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Permissões</h1>
        <p className="text-muted-foreground mt-1">Defina o que cada papel pode fazer e quais campos cada subfunção vê.</p>
      </header>

      <Tabs defaultValue="papeis">
        <TabsList>
          <TabsTrigger value="papeis">Por papel</TabsTrigger>
          <TabsTrigger value="visibilidade">Visibilidade por subfunção</TabsTrigger>
        </TabsList>

        <TabsContent value="papeis" className="space-y-4 mt-4">
          {ROLES.map((role) => (
            <Card key={role.key} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="capitalize">{role.label}</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-muted-foreground">
                      <th className="text-left py-2 pl-2">Área</th>
                      {ACTIONS.map((a) => <th key={a} className="text-center py-2 px-2">{ACTION_LABELS[a]}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {RESOURCES.map((res) => (
                      <tr key={res.key} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 pl-2 font-medium">{res.label}</td>
                        {ACTIONS.map((act) => (
                          <td key={act} className="text-center py-2 px-2">
                            <Checkbox
                              checked={has(role.key, res.key, act)}
                              disabled={toggle.isPending}
                              onCheckedChange={(v) => toggle.mutate({ role: role.key, resource: res.key, action: act, on: !!v })}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground">O <strong>Admin Master</strong> tem acesso total automaticamente.</p>
        </TabsContent>

        <TabsContent value="visibilidade" className="mt-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-4">
              Marque quais campos das demandas cada subfunção pode visualizar. Subfunções sem regra veem todos os campos.
            </p>
            {specs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cadastre Áreas e Subfunções em <strong>Perfis e Acessos</strong> antes de configurar a visibilidade.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-muted-foreground">
                      <th className="text-left py-2 pl-2 sticky left-0 bg-card">Campo</th>
                      {specsByArea.flatMap(({ area, specs: aSpecs }) =>
                        aSpecs.map((s) => (
                          <th key={s.id} className="text-center py-2 px-2 min-w-[120px]">
                            <div className="text-[10px] text-muted-foreground uppercase">{area.name}</div>
                            <div>{s.name}</div>
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {PROJECT_FIELDS.map((field) => (
                      <tr key={field.key} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 pl-2 font-medium sticky left-0 bg-card">{field.label}</td>
                        {specsByArea.flatMap(({ specs: aSpecs }) =>
                          aSpecs.map((s) => (
                            <td key={s.id} className="text-center py-2 px-2">
                              <Checkbox
                                checked={isVisible(s.id, field.key)}
                                disabled={toggleVisibility.isPending}
                                onCheckedChange={(v) => toggleVisibility.mutate({ specialtyId: s.id, fieldKey: field.key, canView: !!v })}
                              />
                            </td>
                          ))
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
