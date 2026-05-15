import { createFileRoute, HeadContent } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/lib/branding-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Briefcase, Plus, X, Upload, CheckCircle2, Loader2 } from "lucide-react";

const AUTOFILL_KEY = "ticket_form_autofill_v1";

export const Route = createFileRoute("/ticket")({
  component: PublicTicketPage,
  head: () => ({
    meta: [
      { title: "Abrir solicitação" },
      { name: "description", content: "Envie uma nova solicitação de projeto para a nossa equipe." },
    ],
  }),
});

const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

type MediaType = { id: string; name: string };

function PublicTicketPage() {
  const { branding } = useBranding();
  const [mediaTypes, setMediaTypes] = useState<MediaType[]>([]);
  const [refLinks, setRefLinks] = useState<string[]>([""]);
  const [files, setFiles] = useState<File[]>([]);
  const [mediaTypeId, setMediaTypeId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [hasAutofill, setHasAutofill] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    supabase.from("media_types").select("id, name").order("sort_order")
      .then(({ data }) => setMediaTypes((data ?? []) as MediaType[]));
    // Autofill from localStorage
    try {
      const raw = localStorage.getItem(AUTOFILL_KEY);
      if (raw && formRef.current) {
        const saved = JSON.parse(raw) as Record<string, string>;
        for (const k of ["name", "email", "phone", "company"]) {
          const el = formRef.current.elements.namedItem(k) as HTMLInputElement | null;
          if (el && saved[k]) el.value = saved[k];
        }
        setHasAutofill(true);
      }
    } catch {}
  }, []);

  const clearAutofill = () => {
    localStorage.removeItem(AUTOFILL_KEY);
    if (formRef.current) {
      for (const k of ["name", "email", "phone", "company"]) {
        const el = formRef.current.elements.namedItem(k) as HTMLInputElement | null;
        if (el) el.value = "";
      }
    }
    setHasAutofill(false);
    toast.success("Dados salvos removidos");
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const next = [...files];
    for (const f of incoming) {
      if (next.length >= MAX_FILES) { toast.error(`Máximo ${MAX_FILES} arquivos`); break; }
      if (f.size > MAX_SIZE) { toast.error(`${f.name} excede 10MB`); continue; }
      next.push(f);
    }
    setFiles(next);
  };

  const removeFile = (idx: number) => setFiles(files.filter((_, i) => i !== idx));

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const title = String(fd.get("title") || "").trim();
    const description = String(fd.get("description") || "").trim();

    if (!name || !email || !title || !description) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("E-mail inválido");
      return;
    }

    setBusy(true);
    try {
      const reqId = crypto.randomUUID();
      const uploaded: { path: string; name: string; size: number; mime: string }[] = [];
      for (const f of files) {
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `public/${reqId}/${Date.now()}_${safe}`;
        const up = await supabase.storage.from("ticket-attachments").upload(path, f, {
          contentType: f.type || "application/octet-stream",
        });
        if (up.error) {
          toast.error(`Falha ao enviar ${f.name}`);
          continue;
        }
        uploaded.push({ path, name: f.name, size: f.size, mime: f.type });
      }

      const payload = {
        id: reqId,
        requester_name: name,
        requester_email: email,
        requester_phone: String(fd.get("phone") || "") || null,
        company: String(fd.get("company") || "") || null,
        title,
        description,
        media_type_id: mediaTypeId || null,
        desired_due_date: String(fd.get("due_date") || "") || null,
        reference_links: refLinks.map((s) => s.trim()).filter(Boolean),
        attachments: uploaded,
        status: "pendente" as const,
      };
      const { error } = await supabase.from("ticket_requests").insert(payload);
      if (error) throw error;
      // Save autofill
      try {
        localStorage.setItem(AUTOFILL_KEY, JSON.stringify({
          name, email,
          phone: String(fd.get("phone") || ""),
          company: String(fd.get("company") || ""),
        }));
      } catch {}
      setDone(true);
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao enviar solicitação");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <HeadContent />
      <div className="min-h-screen bg-muted/30 py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
              <Briefcase className="h-5 w-5" />
            </div>
            <span className="font-semibold text-lg">Equipe.io</span>
          </div>

          {done ? (
            <Card className="p-10 text-center">
              <CheckCircle2 className="h-14 w-14 mx-auto text-primary mb-4" />
              <h1 className="text-2xl font-semibold mb-2">Solicitação recebida!</h1>
              <p className="text-muted-foreground mb-6">
                Obrigado. Nossa equipe vai analisar e entrar em contato em breve.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setDone(false);
                  setFiles([]);
                  setRefLinks([""]);
                  setMediaTypeId("");
                }}
              >
                Enviar outra solicitação
              </Button>
            </Card>
          ) : (
            <Card className="p-6 sm:p-8">
              <header className="mb-6">
                <h1 className="text-2xl font-semibold">Abrir solicitação</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Conte o que você precisa. Quanto mais detalhes, mais rápido podemos começar.
                </p>
              </header>

              <form onSubmit={submit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Seu nome *</Label>
                    <Input id="name" name="name" required maxLength={120} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input id="email" name="email" type="email" required maxLength={200} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" name="phone" maxLength={40} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="company">Empresa</Label>
                    <Input id="company" name="company" maxLength={120} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="title">Título do pedido *</Label>
                  <Input id="title" name="title" required maxLength={200} placeholder="Ex: Reels de lançamento de produto" />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Tipo de mídia</Label>
                    <Select value={mediaTypeId} onValueChange={setMediaTypeId}>
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        {mediaTypes.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="due_date">Prazo desejado</Label>
                    <Input id="due_date" name="due_date" type="date" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Descrição *</Label>
                  <Textarea
                    id="description" name="description" required maxLength={4000} rows={5}
                    placeholder="Descreva o objetivo, público, entregáveis esperados, referências..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Links de referência</Label>
                  {refLinks.map((link, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={link} placeholder="https://..."
                        onChange={(e) => {
                          const next = [...refLinks]; next[i] = e.target.value; setRefLinks(next);
                        }}
                      />
                      {refLinks.length > 1 && (
                        <Button type="button" variant="ghost" size="icon"
                          onClick={() => setRefLinks(refLinks.filter((_, idx) => idx !== i))}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setRefLinks([...refLinks, ""])}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar link
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Anexos (máx. {MAX_FILES} arquivos, 10MB cada)</Label>
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md py-6 cursor-pointer hover:bg-muted/40 transition">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Clique para enviar arquivos</span>
                    <input
                      type="file" multiple className="hidden"
                      onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }}
                    />
                  </label>
                  {files.length > 0 && (
                    <ul className="space-y-1.5">
                      {files.map((f, i) => (
                        <li key={i} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                          <span className="truncate">{f.name} <span className="text-muted-foreground">({(f.size / 1024).toFixed(0)} KB)</span></span>
                          <Button type="button" size="icon" variant="ghost" onClick={() => removeFile(i)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enviar solicitação
                </Button>
              </form>
            </Card>
          )}

          <p className="text-center text-xs text-muted-foreground mt-6">
            Equipe.io · Solicitações são revisadas pela equipe antes de virarem projeto.
          </p>
        </div>
      </div>
    </>
  );
}
