import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/v/$token")({ component: ValidationPage });

function ValidationPage() {
  const { token } = Route.useParams();
  const [feedback, setFeedback] = useState("");
  const [done, setDone] = useState<null | "aprovado" | "reprovado">(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["client-project", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_project_by_token", { _token: token });
      if (error) throw error;
      return (data?.[0] ?? null) as null | {
        id: string; title: string; description: string | null; notes: string | null;
        client_name: string | null; deliverable_path: string | null;
        status_name: string | null; media_type_name: string | null;
        client_decision: string | null; client_feedback: string | null; client_decided_at: string | null;
      };
    },
  });

  const decide = useMutation({
    mutationFn: async (decision: "aprovado" | "reprovado") => {
      const { data, error } = await supabase.rpc("submit_client_decision", {
        _token: token, _decision: decision, _feedback: feedback || "",
      });
      if (error) throw error;
      if (!data) throw new Error("Link inválido ou já utilizado");
      return decision;
    },
    onSuccess: (d) => { setDone(d); refetch(); toast.success("Resposta registrada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadDeliverable = async () => {
    if (!data?.deliverable_path) return;
    const { data: signed, error } = await supabase.storage.from("project-files").createSignedUrl(data.deliverable_path, 300);
    if (error) { toast.error(error.message); return; }
    window.open(signed.signedUrl, "_blank");
  };

  if (isLoading) {
    return <div className="min-h-screen grid place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  if (!data) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-muted/30">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold">Link inválido</h1>
          <p className="text-muted-foreground text-sm mt-2">Este link de validação não existe ou expirou.</p>
        </Card>
      </div>
    );
  }

  const alreadyDecided = !!data.client_decision || !!done;
  const finalDecision = (done ?? data.client_decision) as "aprovado" | "reprovado" | null;

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold">Validação de material</h1>
          <p className="text-muted-foreground text-sm mt-1">Olá{data.client_name ? `, ${data.client_name}` : ""}! Revise o material abaixo.</p>
        </header>

        <Card className="p-6 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Demanda</p>
            <h2 className="text-lg font-semibold">{data.title}</h2>
          </div>
          {data.media_type_name && <p className="text-sm"><span className="text-muted-foreground">Tipo:</span> {data.media_type_name}</p>}
          {data.description && <div><p className="text-xs text-muted-foreground uppercase mb-1">Descrição</p><p className="text-sm whitespace-pre-wrap">{data.description}</p></div>}
          {data.deliverable_path && (
            <Button variant="outline" onClick={downloadDeliverable} className="w-full">
              <Download className="h-4 w-4 mr-2" /> Baixar material para revisão
            </Button>
          )}
        </Card>

        {alreadyDecided ? (
          <Card className={`p-6 text-center ${finalDecision === "aprovado" ? "bg-success/10" : "bg-destructive/10"}`}>
            {finalDecision === "aprovado" ? (
              <><CheckCircle2 className="h-10 w-10 mx-auto text-success mb-2" /><h3 className="font-semibold">Material aprovado</h3></>
            ) : (
              <><XCircle className="h-10 w-10 mx-auto text-destructive mb-2" /><h3 className="font-semibold">Solicitação de alteração registrada</h3></>
            )}
            <p className="text-sm text-muted-foreground mt-1">Obrigado pelo retorno!</p>
            {data.client_feedback && <p className="text-sm mt-3 p-3 bg-background rounded">{data.client_feedback}</p>}
          </Card>
        ) : (
          <Card className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feedback">Comentários (opcional, obrigatório se reprovado)</Label>
              <Textarea id="feedback" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)}
                placeholder="Ajustes, sugestões ou aprovação direta..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={decide.isPending || !feedback.trim()}
                onClick={() => decide.mutate("reprovado")}>
                <XCircle className="h-4 w-4 mr-2" /> Solicitar alterações
              </Button>
              <Button disabled={decide.isPending} onClick={() => decide.mutate("aprovado")}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
