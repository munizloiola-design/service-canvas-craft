import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_portal/aprovados")({ component: PortalAprovados });

type P = { id: string; title: string; description: string | null; deliverable_path: string | null; post_date: string | null; client_decided_at: string | null; client_feedback: string | null };

function PortalAprovados() {
  const { data: projects = [] } = useQuery({
    queryKey: ["portal-aprovados"],
    queryFn: async () => {
      const { data } = await supabase.from("projects")
        .select("id, title, description, deliverable_path, post_date, client_decided_at, client_feedback")
        .eq("client_decision", "aprovado")
        .order("client_decided_at", { ascending: false });
      return (data ?? []) as P[];
    },
  });

  const openFile = async (path: string) => {
    const { data } = await supabase.storage.from("project-files").createSignedUrl(path, 60);
    if (data) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Materiais aprovados</h1>
        <p className="text-muted-foreground mt-1">Histórico de tudo que você já aprovou.</p>
      </header>

      {projects.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum material aprovado ainda.</Card>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <Card key={p.id} className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{p.title}</h3>
                  <Badge className="bg-success/15 text-success border-0">Aprovado</Badge>
                </div>
                {p.description && <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
                  {p.post_date && <span>Postagem: {new Date(p.post_date).toLocaleDateString("pt-BR")}</span>}
                  {p.client_decided_at && <span>Aprovado em: {new Date(p.client_decided_at).toLocaleDateString("pt-BR")}</span>}
                </div>
                {p.client_feedback && <p className="text-xs italic mt-1">"{p.client_feedback}"</p>}
              </div>
              {p.deliverable_path && (
                <Button variant="outline" size="sm" onClick={() => openFile(p.deliverable_path!)}>
                  <Download className="h-4 w-4 mr-1" /> Baixar
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
