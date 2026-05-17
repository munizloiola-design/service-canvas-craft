import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/team")({
  component: TeamPage,
});

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

function TeamPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const qc = useQueryClient();

  const { data: members = [] } = useQuery({
    queryKey: ["team-with-roles"],
    queryFn: async () => {
      const [profilesRes, rolesRes, projectsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("projects").select("assigned_to, status"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (projectsRes.error) throw projectsRes.error;

      return profilesRes.data.map((p) => {
        const userRoles = (rolesRes.data ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole);
        const userProjects = (projectsRes.data ?? []).filter((pr) => pr.assigned_to === p.id);
        return {
          ...p,
          roles: userRoles,
          activeProjects: userProjects.filter((pr) => pr.status !== "concluido").length,
          totalProjects: userProjects.length,
        };
      });
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-with-roles"] });
      toast.success("Papel atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Equipe</h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin ? "Gerencie papéis e visualize a carga de trabalho." : "Visualize a equipe e a carga de trabalho."}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((m) => {
          const initials = (m.full_name || "U").slice(0, 2).toUpperCase();
          const primaryRole = m.roles[0] ?? "membro";
          return (
            <Card key={m.id} className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{m.full_name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.job_title ?? "—"}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                {m.roles.length > 0 ? (
                  m.roles.map((r) => (
                    <Badge key={r} variant="outline" className={ROLE_TONES[r]}>{ROLE_LABELS[r]}</Badge>
                  ))
                ) : (
                  <Badge variant="outline">Sem papel</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-center mb-4">
                <div className="bg-muted/50 rounded-md py-2">
                  <p className="text-xl font-semibold">{m.activeProjects}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ativos</p>
                </div>
                <div className="bg-muted/50 rounded-md py-2">
                  <p className="text-xl font-semibold">{m.totalProjects}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
                </div>
              </div>

              {isAdmin && (
                <Select
                  value={primaryRole}
                  onValueChange={(v) => setRole.mutate({ userId: m.id, role: v as AppRole })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Card>
          );
        })}
      </div>

      {members.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground">
          Nenhum membro cadastrado ainda.
        </Card>
      )}
    </div>
  );
}
