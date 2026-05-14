import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/permissoes")({ component: PermissoesPage });

const ROLES = [
  { key: "admin", label: "Administrador" },
  { key: "gerente", label: "Gerente" },
  { key: "membro", label: "Membro" },
] as const;

const RESOURCES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "projects", label: "Demandas / Projetos" },
  { key: "calendario", label: "Calendário" },
  { key: "financeiro", label: "Financeiro" },
  { key: "orcamento", label: "Orçamento" },
  { key: "equipamentos", label: "Equipamentos" },
  { key: "team", label: "Equipe" },
  { key: "cadastros", label: "Cadastros" },
] as const;

const ACTIONS = ["view", "create", "edit", "delete"] as const;
const ACTION_LABELS: Record<string, string> = {
  view: "Ver", create: "Criar", edit: "Editar", delete: "Excluir",
};

function PermissoesPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
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

  if (!isAdmin) {
    return <div className="p-8"><p className="text-muted-foreground">Apenas administradores podem editar permissões.</p></div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Permissões</h1>
        <p className="text-muted-foreground mt-1">Defina o que cada papel pode fazer em cada área do sistema.</p>
      </header>

      <div className="space-y-4">
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
                            disabled={role.key === "admin" || toggle.isPending}
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
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        O papel <strong>Administrador</strong> tem acesso total e não pode ser modificado por aqui.
      </p>
    </div>
  );
}
