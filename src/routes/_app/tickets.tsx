import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Inbox, Mail, Phone, Building2, Calendar, FileText, Check, X, Loader2, Download } from "lucide-react";

export const Route = createFileRoute("/_app/tickets")({
  component: TicketsPage,
});

type Attachment = { path: string; name: string; size: number; mime: string };
type TicketRequest = {
  id: string;
  requester_name: string;
  requester_email: string;
  requester_phone: string | null;
  company: string | null;
  title: string;
  description: string;
  media_type_id: string | null;
  desired_due_date: string | null;
  reference_links: string[];
  attachments: Attachment[];
  status: "pendente" | "aprovado" | "recusado";
  review_notes: string | null;
  reviewed_at: string | null;
  created_project_id: string | null;
  created_at: string;
};

function TicketsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pendente" | "aprovado" | "recusado">("pendente");
  const [selected, setSelected] = useState<TicketRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["ticket_requests", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_requests")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TicketRequest[];
    },
  });

  const approve = useMutation({
    mutationFn: async (t: TicketRequest) => {
      // 1. Create project
      const { data: proj, error: pErr } = await supabase
        .from("projects")
        .insert({
          title: t.title,
          description: t.description,
          notes: `Solicitação de ${t.requester_name} <${t.requester_email}>${t.company ? ` — ${t.company}` : ""}`,
          media_type_id: t.media_type_id,
          due_date: t.desired_due_date,
          reference_links: t.reference_links ?? [],
          has_reference: (t.reference_links?.length ?? 0) > 0,
          client_token: crypto.randomUUID().replace(/-/g, ""),
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (pErr) throw pErr;

      // 2. Move attachments to project-files
      for (const att of t.attachments ?? []) {
        const { data: blob, error: dErr } = await supabase.storage.from("ticket-attachments").download(att.path);
        if (dErr || !blob) continue;
        const newPath = `${proj.id}/${Date.now()}_${att.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const up = await supabase.storage.from("project-files").upload(newPath, blob, { contentType: att.mime || undefined });
        if (up.error) continue;
        await supabase.from("project_attachments").insert({
          project_id: proj.id,
          file_name: att.name,
          file_path: newPath,
          file_size: att.size,
          mime_type: att.mime,
          uploaded_by: user!.id,
        });
        await supabase.storage.from("ticket-attachments").remove([att.path]);
      }

      // 3. Mark ticket approved
      const { error: uErr } = await supabase
        .from("ticket_requests")
        .update({
          status: "aprovado",
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          created_project_id: proj.id,
        })
        .eq("id", t.id);
      if (uErr) throw uErr;
    },
    onSuccess: () => {
      toast.success("Ticket aprovado e projeto criado");
      qc.invalidateQueries({ queryKey: ["ticket_requests"] });
      setSelected(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao aprovar"),
  });

  const reject = useMutation({
    mutationFn: async ({ t, note }: { t: TicketRequest; note: string }) => {
      const { error } = await supabase
        .from("ticket_requests")
        .update({
          status: "recusado",
          review_notes: note,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket recusado");
      qc.invalidateQueries({ queryKey: ["ticket_requests"] });
      setSelected(null);
      setRejectNote("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao recusar"),
  });

  const downloadAttachment = async (att: Attachment) => {
    const { data, error } = await supabase.storage.from("ticket-attachments").createSignedUrl(att.path, 60);
    if (error || !data) return toast.error("Falha ao gerar link");
    window.open(data.signedUrl, "_blank");
  };

  const ticketUrl = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/ticket` : "/ticket"),
    []
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Inbox className="h-6 w-6" /> Tickets
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Solicitações enviadas pelo formulário público.
          </p>
        </div>
        <Card className="px-4 py-3 flex items-center gap-3">
          <div className="text-xs">
            <p className="text-muted-foreground">Link público</p>
            <code className="text-sm">{ticketUrl}</code>
          </div>
          <Button
            size="sm" variant="outline"
            onClick={() => { navigator.clipboard.writeText(ticketUrl); toast.success("Link copiado"); }}
          >
            Copiar
          </Button>
        </Card>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pendente">Pendentes</TabsTrigger>
          <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
          <TabsTrigger value="recusado">Recusados</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">Carregando...</div>
          ) : tickets.length === 0 ? (
            <Card className="py-12 text-center text-muted-foreground">
              Nenhum ticket {tab}.
            </Card>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <Card
                  key={t.id}
                  className="p-4 cursor-pointer hover:border-primary transition"
                  onClick={() => setSelected(t)}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{t.title}</h3>
                        {t.attachments?.length > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            <FileText className="h-3 w-3 mr-1" />{t.attachments.length}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span>{t.requester_name}</span>
                        <span>{t.requester_email}</span>
                        {t.company && <span>{t.company}</span>}
                        <span>{new Date(t.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setRejectNote(""); } }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <section className="space-y-2 text-sm">
                  <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {selected.requester_email}</div>
                  {selected.requester_phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {selected.requester_phone}</div>}
                  {selected.company && <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /> {selected.company}</div>}
                  {selected.desired_due_date && <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> Prazo: {new Date(selected.desired_due_date).toLocaleDateString("pt-BR")}</div>}
                </section>

                <section>
                  <h4 className="text-sm font-semibold mb-1">Descrição</h4>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{selected.description}</p>
                </section>

                {selected.reference_links?.length > 0 && (
                  <section>
                    <h4 className="text-sm font-semibold mb-1">Links</h4>
                    <ul className="text-sm space-y-1">
                      {selected.reference_links.map((l, i) => (
                        <li key={i}><a href={l} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">{l}</a></li>
                      ))}
                    </ul>
                  </section>
                )}

                {selected.attachments?.length > 0 && (
                  <section>
                    <h4 className="text-sm font-semibold mb-2">Anexos</h4>
                    <ul className="space-y-1.5">
                      {selected.attachments.map((a, i) => (
                        <li key={i} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                          <span className="truncate">{a.name}</span>
                          <Button size="sm" variant="ghost" onClick={() => downloadAttachment(a)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {selected.status === "recusado" && selected.review_notes && (
                  <section className="bg-muted/40 rounded-md p-3">
                    <h4 className="text-sm font-semibold mb-1">Motivo da recusa</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.review_notes}</p>
                  </section>
                )}

                {selected.status === "pendente" && (
                  <section className="border-t pt-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="reject_note">Motivo (apenas se for recusar)</Label>
                      <Textarea id="reject_note" rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        disabled={approve.isPending}
                        onClick={() => approve.mutate(selected)}
                      >
                        {approve.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                        Aprovar e criar projeto
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        disabled={reject.isPending || !rejectNote.trim()}
                        onClick={() => reject.mutate({ t: selected, note: rejectNote.trim() })}
                      >
                        {reject.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
                        Recusar
                      </Button>
                    </div>
                  </section>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
