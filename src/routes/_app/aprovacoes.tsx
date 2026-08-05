import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { approveRegistration, rejectRegistration } from "@/lib/approvals.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, X, Copy, Building2, Briefcase, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/_app/aprovacoes")({ component: AprovacoesPage });

type Registration = {
  id: string;
  type: "cliente" | "usuario";
  email: string;
  full_name: string;
  company_name: string | null;
  phone: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

function AprovacoesPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [rejectFor, setRejectFor] = useState<Registration | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [linkModal, setLinkModal] = useState<string | null>(null);

  const doApprove = useServerFn(approveRegistration);
  const doReject = useServerFn(rejectRegistration);

  const { data: rows = [] } = useQuery({
    queryKey: ["pending_registrations", tab],
    enabled: isManager,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from as any)("pending_registrations")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false });
      return (data ?? []) as Registration[];
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) => doApprove({ data: { id } }),
    onSuccess: (res) => {
      toast.success("Cadastro aprovado");
      qc.invalidateQueries({ queryKey: ["pending_registrations"] });
      if (res?.action_link) setLinkModal(res.action_link);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async () => {
      if (!rejectFor) return;
      await doReject({ data: { id: rejectFor.id, reason: rejectReason || undefined } });
    },
    onSuccess: () => {
      toast.success("Cadastro rejeitado");
      qc.invalidateQueries({ queryKey: ["pending_registrations"] });
      setRejectFor(null);
      setRejectReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isManager) {
    return <div className="p-8 text-muted-foreground">Você não tem permissão para ver aprovações.</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <ClipboardCheck className="h-7 w-7 text-primary" /> Aprovações
        </h1>
        <p className="text-muted-foreground mt-1">Cadastros públicos aguardando revisão.</p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          {sec.can("pending") && <TabsTrigger value="pending">Pendentes</TabsTrigger>}
          {sec.can("approved") && <TabsTrigger value="approved">Aprovados</TabsTrigger>}
          {sec.can("rejected") && <TabsTrigger value="rejected">Rejeitados</TabsTrigger>}
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {rows.length === 0 && (
            <Card className="p-12 text-center text-muted-foreground">Nenhum cadastro nesta categoria.</Card>
          )}
          {rows.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {r.type === "cliente" ? <Building2 className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{r.full_name}</p>
                    <Badge variant="outline">{r.type === "cliente" ? "Cliente" : "Usuário"}</Badge>
                    {r.company_name && <Badge variant="secondary">{r.company_name}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{r.email}{r.phone ? ` • ${r.phone}` : ""}</p>
                  {r.notes && <p className="text-sm mt-2 whitespace-pre-wrap">{r.notes}</p>}
                  {r.rejection_reason && <p className="text-xs mt-2 text-destructive">Motivo: {r.rejection_reason}</p>}
                  <p className="text-[10px] text-muted-foreground mt-2">Enviado em {new Date(r.created_at).toLocaleString("pt-BR")}</p>
                </div>
                {tab === "pending" && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" onClick={() => approve.mutate(r.id)} disabled={approve.isPending}>
                      <Check className="h-4 w-4 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRejectFor(r)}>
                      <X className="h-4 w-4 mr-1" /> Rejeitar
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!rejectFor} onOpenChange={(o) => { if (!o) { setRejectFor(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar cadastro</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Informe o motivo (opcional):</p>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => reject.mutate()} disabled={reject.isPending}>Rejeitar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PasswordLinkModal link={linkModal} onClose={() => setLinkModal(null)} />
    </div>
  );
}

export function PasswordLinkModal({ link, onClose }: { link: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!link} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Link para criar senha</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Compartilhe este link com o usuário para que ele defina a senha. Válido por 24 horas.
        </p>
        <div className="flex gap-2">
          <Input readOnly value={link ?? ""} className="text-xs" />
          <Button size="sm" onClick={() => { if (link) { navigator.clipboard.writeText(link); toast.success("Copiado"); } }}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
