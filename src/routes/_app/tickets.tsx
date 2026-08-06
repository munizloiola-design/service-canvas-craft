import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSectionGate } from "@/lib/access-sections";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Inbox, Mail, Phone, Building2, Calendar, FileText, Check, X, Loader2, Download, Pencil, Trash2, MessageCircle, Plus } from "lucide-react";

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
  internal_notes: string | null;
  reviewed_at: string | null;
  created_project_id: string | null;
  created_at: string;
};

function whatsappUrl(phone: string | null) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length <= 11) digits = "55" + digits;
  return `https://wa.me/${digits}`;
}

import { sendTransactionalEmail } from "@/lib/email/send";

async function notifyDecision(
  t: TicketRequest,
  decision: "approved" | "rejected",
  reviewNotes: string,
  trackUrl?: string | null,
) {
  const { data: brand } = await supabase
    .from("app_branding")
    .select("brand_name, logo_url, primary_color")
    .eq("id", true)
    .maybeSingle();

  const templateName = decision === "approved" ? "ticket-approved" : "ticket-rejected";
  const templateData: Record<string, unknown> = {
    requesterName: t.requester_name,
    ticketTitle: t.title,
    brandName: brand?.brand_name ?? "Dig.Workflow",
    brandLogoUrl: brand?.logo_url ?? null,
    primaryColor: brand?.primary_color ?? "#3b82f6",
  };
  if (decision === "approved" && trackUrl) templateData.trackUrl = trackUrl;
  if (decision === "rejected") templateData.reviewNotes = reviewNotes;

  await sendTransactionalEmail({
    templateName,
    recipientEmail: t.requester_email,
    idempotencyKey: `ticket-${t.id}-${decision}`,
    templateData,
  });
}

function TicketsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const sec = useSectionGate("/tickets");
  const [tab, setTab] = useState<"pendente" | "aprovado" | "recusado">(
    (["pendente", "aprovado", "recusado"] as const).find((s) => sec.can(s)) ?? "pendente",
  );
  const [selected, setSelected] = useState<TicketRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TicketRequest | null>(null);

  // Editable fields
  const [eTitle, setETitle] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eMedia, setEMedia] = useState<string>("");
  const [eDue, setEDue] = useState("");
  const [eLinks, setELinks] = useState<string[]>([]);
  const [eNotes, setENotes] = useState("");

  const { data: mediaTypes = [] } = useQuery({
    queryKey: ["media_types_all"],
    queryFn: async () => {
      const { data } = await supabase.from("media_types").select("id, name").order("sort_order");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["ticket_requests", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_requests")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TicketRequest[];
    },
  });

  useEffect(() => {
    if (selected) {
      setETitle(selected.title);
      setEDesc(selected.description);
      setEMedia(selected.media_type_id ?? "");
      setEDue(selected.desired_due_date ?? "");
      setELinks(selected.reference_links?.length ? selected.reference_links : [""]);
      setENotes(selected.internal_notes ?? "");
      setEditing(false);
    }
  }, [selected]);

  const approve = useMutation({
    mutationFn: async (t: TicketRequest) => {
      const clientToken = crypto.randomUUID().replace(/-/g, "");
      const { data: atendimento } = await supabase
        .from("workflow_statuses")
        .select("id")
        .ilike("name", "atendimento")
        .maybeSingle();
      const { data: proj, error: pErr } = await supabase
        .from("projects").insert({
          title: t.title,
          description: t.description,
          notes: `Solicitação de ${t.requester_name} <${t.requester_email}>${t.company ? ` — ${t.company}` : ""}${t.internal_notes ? `\n\nNotas: ${t.internal_notes}` : ""}`,
          media_type_id: t.media_type_id,
          due_date: t.desired_due_date,
          reference_links: t.reference_links ?? [],
          has_reference: (t.reference_links?.length ?? 0) > 0,
          client_token: clientToken,
          created_by: user?.id,
          status_id: atendimento?.id ?? null,
        }).select("id").single();
      if (pErr) throw pErr;

      for (const att of t.attachments ?? []) {
        const { data: blob, error: dErr } = await supabase.storage.from("ticket-attachments").download(att.path);
        if (dErr || !blob) continue;
        const newPath = `${proj.id}/${Date.now()}_${att.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const up = await supabase.storage.from("project-files").upload(newPath, blob, { contentType: att.mime || undefined });
        if (up.error) continue;
        await supabase.from("project_attachments").insert({
          project_id: proj.id, file_name: att.name, file_path: newPath,
          file_size: att.size, mime_type: att.mime, uploaded_by: user!.id,
        });
        await supabase.storage.from("ticket-attachments").remove([att.path]);
      }

      const { error: uErr } = await supabase.from("ticket_requests").update({
        status: "aprovado", reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(), created_project_id: proj.id,
      }).eq("id", t.id);
      if (uErr) throw uErr;

      const trackUrl = `${window.location.origin}/v/${clientToken}`;
      try {
        await notifyDecision(t, "approved", "", trackUrl);
      } catch (e: any) {
        console.error("[ticket-email] approve failed", e);
        return { emailFailed: true as const, error: e?.message };
      }
      return { emailFailed: false as const };
    },
    onSuccess: (res) => {
      if (res?.emailFailed) {
        toast.warning("Ticket aprovado, mas o e-mail não foi enviado");
      } else {
        toast.success("Ticket aprovado e projeto criado");
      }
      qc.invalidateQueries({ queryKey: ["ticket_requests"] });
      setSelected(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao aprovar"),
  });

  const reject = useMutation({
    mutationFn: async ({ t, note }: { t: TicketRequest; note: string }) => {
      const { error } = await supabase.from("ticket_requests").update({
        status: "recusado", review_notes: note,
        reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
      }).eq("id", t.id);
      if (error) throw error;
      try {
        await notifyDecision(t, "rejected", note);
      } catch (e: any) {
        console.error("[ticket-email] reject failed", e);
        return { emailFailed: true as const };
      }
      return { emailFailed: false as const };
    },
    onSuccess: (res) => {
      if (res?.emailFailed) {
        toast.warning("Ticket recusado, mas o e-mail não foi enviado");
      } else {
        toast.success("Ticket recusado");
      }
      qc.invalidateQueries({ queryKey: ["ticket_requests"] });
      setSelected(null); setRejectNote("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao recusar"),
  });

  const saveEdit = useMutation({
    mutationFn: async (t: TicketRequest) => {
      const { error } = await supabase.from("ticket_requests").update({
        title: eTitle.trim(),
        description: eDesc.trim(),
        media_type_id: eMedia || null,
        desired_due_date: eDue || null,
        reference_links: eLinks.map((l) => l.trim()).filter(Boolean),
        internal_notes: eNotes.trim() || null,
      }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket atualizado");
      qc.invalidateQueries({ queryKey: ["ticket_requests"] });
      setEditing(false);
      setSelected(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (t: TicketRequest) => {
      if (t.attachments?.length) {
        await supabase.storage.from("ticket-attachments").remove(t.attachments.map((a) => a.path));
      }
      const { error } = await supabase.from("ticket_requests").delete().eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket excluído");
      qc.invalidateQueries({ queryKey: ["ticket_requests"] });
      setDeleteTarget(null);
      setSelected(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
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
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <header className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Inbox className="h-6 w-6" /> Tickets
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Solicitações enviadas pelo formulário público.</p>
        </div>
        <Card className="px-4 py-3 flex items-center gap-3">
          <div className="text-xs">
            <p className="text-muted-foreground">Link público</p>
            <code className="text-sm">{ticketUrl}</code>
          </div>
          <Button size="sm" variant="outline"
            onClick={() => { navigator.clipboard.writeText(ticketUrl); toast.success("Link copiado"); }}>
            Copiar
          </Button>
        </Card>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          {sec.can("pendente") && <TabsTrigger value="pendente">Pendentes</TabsTrigger>}
          {sec.can("aprovado") && <TabsTrigger value="aprovado">Aprovados</TabsTrigger>}
          {sec.can("recusado") && <TabsTrigger value="recusado">Recusados</TabsTrigger>}
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">Carregando...</div>
          ) : tickets.length === 0 ? (
            <Card className="py-12 text-center text-muted-foreground">Nenhum ticket {tab}.</Card>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => {
                const wpp = whatsappUrl(t.requester_phone);
                return (
                  <Card key={t.id} className="p-4 hover:border-primary transition">
                    <div className="flex justify-between items-start gap-4">
                      <button className="text-left min-w-0 flex-1" onClick={() => setSelected(t)}>
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
                      </button>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" title="Editar"
                          onClick={() => { setSelected(t); setTimeout(() => setEditing(true), 0); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {wpp && (
                          <Button asChild size="icon" variant="ghost" title="WhatsApp">
                            <a href={wpp} target="_blank" rel="noreferrer">
                              <MessageCircle className="h-4 w-4 text-green-600" />
                            </a>
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" title="Excluir"
                          onClick={() => setDeleteTarget(t)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setRejectNote(""); setEditing(false); } }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="pr-8">{editing ? "Editar ticket" : selected.title}</SheetTitle>
              </SheetHeader>

              {!editing ? (
                <div className="mt-6 space-y-5">
                  <section className="space-y-2 text-sm">
                    <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {selected.requester_email}</div>
                    {selected.requester_phone && (
                      <div className="flex items-center gap-2 justify-between">
                        <span className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {selected.requester_phone}</span>
                        {whatsappUrl(selected.requester_phone) && (
                          <a href={whatsappUrl(selected.requester_phone)!} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-green-600 text-xs hover:underline">
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </a>
                        )}
                      </div>
                    )}
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

                  {selected.internal_notes && (
                    <section className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md p-3">
                      <h4 className="text-sm font-semibold mb-1">Notas internas</h4>
                      <p className="text-sm whitespace-pre-wrap">{selected.internal_notes}</p>
                    </section>
                  )}

                  {selected.status === "recusado" && selected.review_notes && (
                    <section className="bg-muted/40 rounded-md p-3">
                      <h4 className="text-sm font-semibold mb-1">Motivo da recusa</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.review_notes}</p>
                    </section>
                  )}

                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                      <Pencil className="h-4 w-4 mr-2" /> Editar
                    </Button>
                    {whatsappUrl(selected.requester_phone) && (
                      <Button asChild variant="outline" size="sm">
                        <a href={whatsappUrl(selected.requester_phone)!} target="_blank" rel="noreferrer">
                          <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
                        </a>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="text-destructive"
                      onClick={() => setDeleteTarget(selected)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                    </Button>
                  </div>

                  {selected.status === "pendente" && (
                    <section className="border-t pt-4 space-y-3">
                      <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                        Ao aprovar/recusar, um e-mail será enviado para <strong>{selected.requester_email}</strong>.
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="reject_note">Motivo (apenas se for recusar)</Label>
                        <Textarea id="reject_note" rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
                      </div>
                      <div className="flex gap-2">
                        <Button className="flex-1" disabled={approve.isPending} onClick={() => approve.mutate(selected)}>
                          {approve.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                          Aprovar e criar projeto
                        </Button>
                        <Button variant="outline" className="flex-1"
                          disabled={reject.isPending || !rejectNote.trim()}
                          onClick={() => reject.mutate({ t: selected, note: rejectNote.trim() })}>
                          {reject.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
                          Recusar
                        </Button>
                      </div>
                    </section>
                  )}
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label>Título</Label>
                    <Input value={eTitle} onChange={(e) => setETitle(e.target.value)} maxLength={200} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descrição</Label>
                    <Textarea rows={5} value={eDesc} onChange={(e) => setEDesc(e.target.value)} maxLength={4000} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Tipo de mídia</Label>
                      <Select value={eMedia} onValueChange={setEMedia}>
                        <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                        <SelectContent>
                          {mediaTypes.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Prazo desejado</Label>
                      <Input type="date" value={eDue} onChange={(e) => setEDue(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Links de referência</Label>
                    {eLinks.map((l, i) => (
                      <div key={i} className="flex gap-2">
                        <Input value={l} placeholder="https://..." onChange={(e) => {
                          const next = [...eLinks]; next[i] = e.target.value; setELinks(next);
                        }} />
                        {eLinks.length > 1 && (
                          <Button type="button" variant="ghost" size="icon"
                            onClick={() => setELinks(eLinks.filter((_, idx) => idx !== i))}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setELinks([...eLinks, ""])}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar link
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notas internas (não vão para o cliente)</Label>
                    <Textarea rows={3} value={eNotes} onChange={(e) => setENotes(e.target.value)} maxLength={2000} />
                  </div>
                  <div className="flex gap-2 border-t pt-4">
                    <Button onClick={() => saveEdit.mutate(selected)} disabled={saveEdit.isPending || !eTitle.trim() || !eDesc.trim()}>
                      {saveEdit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Salvar alterações
                    </Button>
                    <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os anexos enviados também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && remove.mutate(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
