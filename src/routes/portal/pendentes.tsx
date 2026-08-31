import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Download, Link as LinkIcon, Check, X } from "lucide-react";
import { formatDateBR } from "@/lib/dates";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/pendentes")({ component: PortalPendentes });

type P = { id: string; title: string; description: string | null; deliverable_path: string | null; reference_links: string[]; due_date: string | null; post_date: string | null };

function PortalPendentes() {
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const { data: statuses = [] } = useQuery({
    queryKey: ["workflow_statuses"],
    queryFn: async () => (await supabase.from("workflow_statuses").select("id, is_client_validation")).data as { id: string; is_client_validation: boolean }[] ?? [],
  });
  const validationIds = statuses.filter((s) => s.is_client_validation).map((s) => s.id);

  const { data: projects = [] } = useQuery({
    queryKey: ["portal-pendentes", validationIds.join(",")],
    enabled: validationIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("projects")
        .select("id, title, description, deliverable_path, reference_links, due_date, post_date, status_id, client_decision")
        .in("status_id", validationIds)
        .is("client_decision", null);
      return (data ?? []) as P[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "aprovado" | "reprovado" }) => {
      const { error } = await supabase.rpc("submit_client_decision_authed", {
        _project_id: id, _decision: decision, _feedback: feedback[id] ?? "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Decisão registrada");
      qc.invalidateQueries({ queryKey: ["portal-pendentes"] });
      qc.invalidateQueries({ queryKey: ["portal-aprovados"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openFile = async (path: string) => {
    const { data } = await supabase.storage.from("project-files").createSignedUrl(path, 60);
    if (data) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Pendentes de aprovação</h1>
        <p className="text-muted-foreground mt-1">Revise e aprove os materiais enviados pela equipe.</p>
      </header>

      {projects.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum material aguardando sua aprovação.</Card>
      ) : (
        <div className="space-y-4">
          {projects.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-semibold text-lg">{p.title}</h3>
                <Badge variant="secondary">Aguardando</Badge>
              </div>
              {p.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-3">{p.description}</p>}
              <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                {p.due_date && <span>Prazo: {formatDateBR(p.due_date)}</span>}
                {p.post_date && <span>Postagem: {formatDateBR(p.post_date)}</span>}
              </div>
              {p.reference_links?.length > 0 && (
                <ul className="text-xs space-y-0.5 mb-3">
                  {p.reference_links.map((u, i) => (
                    <li key={i}><a href={u} target="_blank" rel="noreferrer" className="text-info hover:underline inline-flex items-center gap-1 break-all"><LinkIcon className="h-3 w-3" />{u}</a></li>
                  ))}
                </ul>
              )}
              {p.deliverable_path && (
                <Button variant="outline" size="sm" className="mb-3" onClick={() => openFile(p.deliverable_path!)}>
                  <Download className="h-4 w-4 mr-1" /> Ver material
                </Button>
              )}
              <Textarea placeholder="Feedback (opcional para aprovar, obrigatório para reprovar)" className="mb-3"
                value={feedback[p.id] ?? ""} onChange={(e) => setFeedback((f) => ({ ...f, [p.id]: e.target.value }))} />
              <div className="flex gap-2">
                <Button onClick={() => decide.mutate({ id: p.id, decision: "aprovado" })} disabled={decide.isPending}>
                  <Check className="h-4 w-4 mr-1" /> Aprovar
                </Button>
                <Button variant="outline" className="text-destructive"
                  onClick={() => {
                    if (!feedback[p.id]) { toast.error("Inclua um feedback para reprovar"); return; }
                    decide.mutate({ id: p.id, decision: "reprovado" });
                  }} disabled={decide.isPending}>
                  <X className="h-4 w-4 mr-1" /> Reprovar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
