import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Clock, CheckCircle2, AlertTriangle, Users } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

const STATUS_LABELS: Record<string, string> = {
  a_fazer: "A fazer",
  em_andamento: "Em andamento",
  em_revisao: "Em revisão",
  concluido: "Concluído",
};

function DashboardPage() {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: teamCount = 0 } = useQuery({
    queryKey: ["team-count"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const total = projects.length;
  const inProgress = projects.filter((p) => p.status === "em_andamento").length;
  const done = projects.filter((p) => p.status === "concluido").length;
  const urgent = projects.filter((p) => p.priority === "urgente" && p.status !== "concluido").length;

  const stats = [
    { label: "Total de projetos", value: total, icon: FolderKanban, color: "text-info" },
    { label: "Em andamento", value: inProgress, icon: Clock, color: "text-warning" },
    { label: "Concluídos", value: done, icon: CheckCircle2, color: "text-success" },
    { label: "Urgentes", value: urgent, icon: AlertTriangle, color: "text-destructive" },
    { label: "Membros da equipe", value: teamCount, icon: Users, color: "text-primary" },
  ];

  const recent = projects.slice(0, 5);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral dos projetos e da equipe.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{s.label}</span>
                <Icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className="text-3xl font-semibold mt-3">{s.value}</p>
            </Card>
          );
        })}
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Projetos recentes</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhum projeto ainda. Crie o primeiro na aba Projetos.
          </p>
        ) : (
          <div className="divide-y">
            {recent.map((p) => (
              <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.client_name ?? "Sem cliente"} · {p.due_date ? `Prazo ${new Date(p.due_date).toLocaleDateString("pt-BR")}` : "Sem prazo"}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">{STATUS_LABELS[p.status]}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
