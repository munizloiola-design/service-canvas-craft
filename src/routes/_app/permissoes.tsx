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

function PermissoesPage() {
  const { isMaster } = useAuth();
  const qc = useQueryClient();
  const { refresh } = usePermissions();

  const { data: rows = [] } = useQuery({
    queryKey: ["role_permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("*");
      if (error) throw error;
      return data as { id: string; role: string; resource: string; action: string }[];
    },
  });

  const { data: functions = [] } = useQuery({
    queryKey: ["collaborator_functions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("collaborator_functions").select("*").order("sort_order");
      if (error) throw error;
      return data as { id: string; key: string; name: string }[];
    },
  });

  const { data: visibility = [] } = useQuery({
    queryKey: ["function_field_visibility"],
    queryFn: async () => {
      const { data, error } = await supabase.from("function_field_visibility").select("*");
      if (error) throw error;
      return data as { id: string; function_id: string; field_key: string; visible: boolean }[];
    },
  });

  const has = (role: string, resource: string, action: string) =>
    rows.some((r) => r.role === role && r.resource === resource && r.action === action);

  const toggle = useMutation({
    mutationFn: async ({ role, resource, action, on }: { role: string; resource: string; action: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase.from("role_permissions").insert({ role: role as "admin" | "gerente" | "membro", resource, action });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("role_permissions").delete().eq("role", role as "admin" | "gerente" | "membro").eq("resource", resource).eq("action", action);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["role_permissions"] });
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isVisible = (functionId: string, fieldKey: string) => {
    const row = visibility.find((v) => v.function_id === functionId && v.field_key === fieldKey);
    return row ? row.visible : true;
  };

  const toggleVisibility = useMutation({
    mutationFn: async ({ functionId, fieldKey, visible }: { functionId: string; fieldKey: string; visible: boolean }) => {
      const existing = visibility.find((v) => v.function_id === functionId && v.field_key === fieldKey);
      if (existing) {
        const { error } = await supabase.from("function_field_visibility").update({ visible }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("function_field_visibility").insert({ function_id: functionId, field_key: fieldKey, visible });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["function_field_visibility"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isMaster) {
    return <div className="p-4 md:p-8"><p className="text-muted-foreground">Apenas o Administrador Master pode editar permissões.</p></div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Permissões</h1>
        <p className="text-muted-foreground mt-1">Defina o que cada papel pode fazer e quais campos cada função vê.</p>
      </header>

      <Tabs defaultValue="papeis">
        <TabsList>
          <TabsTrigger value="papeis">Por papel</TabsTrigger>
          <TabsTrigger value="visibilidade">Visibilidade por função</TabsTrigger>
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
              Marque quais campos das demandas cada subfunção de colaborador pode visualizar. Colaboradores sem nenhuma função veem todos os campos.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="text-left py-2 pl-2 sticky left-0 bg-card">Campo</th>
                    {functions.map((f) => (
                      <th key={f.id} className="text-center py-2 px-2 min-w-[100px]">{f.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PROJECT_FIELDS.map((field) => (
                    <tr key={field.key} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 pl-2 font-medium sticky left-0 bg-card">{field.label}</td>
                      {functions.map((f) => (
                        <td key={f.id} className="text-center py-2 px-2">
                          <Checkbox
                            checked={isVisible(f.id, field.key)}
                            disabled={toggleVisibility.isPending}
                            onCheckedChange={(v) => toggleVisibility.mutate({ functionId: f.id, fieldKey: field.key, visible: !!v })}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
