import { createFileRoute, HeadContent } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/lib/branding-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Wallet, Upload, X, CheckCircle2, Loader2 } from "lucide-react";

const AUTOFILL_KEY = "lancamento_form_autofill_v1";
const MAX_SIZE = 10 * 1024 * 1024;

type Cat = { id: string; name: string; kind: "income" | "expense" };

export const Route = createFileRoute("/lancamento")({
  component: PublicLancamentoPage,
  head: () => ({
    meta: [
      { title: "Enviar lançamento financeiro" },
      {
        name: "description",
        content:
          "Envie uma entrada ou saída financeira para o time. Sua solicitação passará por aprovação.",
      },
      { property: "og:title", content: "Enviar lançamento financeiro" },
      {
        property: "og:description",
        content: "Formulário público para envio de entradas e saídas financeiras.",
      },
    ],
  }),
});

function PublicLancamentoPage() {
  const { branding } = useBranding();
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [categoryId, setCategoryId] = useState<string>("");
  const [categories, setCategories] = useState<Cat[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [hasAutofill, setHasAutofill] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    supabase
      .from("financial_categories")
      .select("id, name, kind")
      .order("name")
      .then(({ data }) => setCategories((data ?? []) as Cat[]));
    try {
      const raw = localStorage.getItem(AUTOFILL_KEY);
      if (raw && formRef.current) {
        const saved = JSON.parse(raw) as Record<string, string>;
        for (const k of ["name", "email"]) {
          const el = formRef.current.elements.namedItem(k) as HTMLInputElement | null;
          if (el && saved[k]) el.value = saved[k];
        }
        setHasAutofill(true);
      }
    } catch {}
  }, []);

  const filteredCats = categories.filter((c) => c.kind === kind);

  const clearAutofill = () => {
    localStorage.removeItem(AUTOFILL_KEY);
    if (formRef.current) {
      for (const k of ["name", "email"]) {
        const el = formRef.current.elements.namedItem(k) as HTMLInputElement | null;
        if (el) el.value = "";
      }
    }
    setHasAutofill(false);
    toast.success("Dados salvos removidos");
  };

  const onFileChange = (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    if (f.size > MAX_SIZE) {
      toast.error("Arquivo excede 10MB");
      return;
    }
    setFile(f);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const description = String(fd.get("description") || "").trim();
    const entry_date = String(fd.get("entry_date") || "");
    const amount = Number(fd.get("amount") || 0);
    const notes = String(fd.get("notes") || "").trim();

    if (!name || !email || !description || !entry_date) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("E-mail inválido");
      return;
    }
    if (!(amount > 0)) {
      toast.error("Informe um valor maior que zero");
      return;
    }

    setBusy(true);
    try {
      const reqId = crypto.randomUUID();
      let receiptPath: string | null = null;
      if (file) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `pending/${reqId}/${Date.now()}_${safe}`;
        const up = await supabase.storage
          .from("financial-receipts")
          .upload(path, file, {
            contentType: file.type || "application/octet-stream",
          });
        if (up.error) {
          toast.error(`Falha ao enviar comprovante: ${up.error.message}`);
        } else {
          receiptPath = path;
        }
      }

      const { error } = await supabase.from("financial_entry_requests").insert({
        id: reqId,
        requester_name: name,
        requester_email: email,
        requester_notes: notes || null,
        kind,
        entry_date,
        description,
        amount,
        category_id: categoryId || null,
        receipt_path: receiptPath,
        status: "pendente",
      });
      if (error) throw error;

      try {
        localStorage.setItem(AUTOFILL_KEY, JSON.stringify({ name, email }));
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
            {branding.logo_url ? (
              <img
                src={branding.logo_url}
                alt="logo"
                className="h-9 w-9 rounded-md object-contain"
              />
            ) : (
              <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
                <Wallet className="h-5 w-5" />
              </div>
            )}
            <span className="font-semibold text-lg">{branding.brand_name}</span>
          </div>

          {done ? (
            <Card className="p-10 text-center">
              <CheckCircle2 className="h-14 w-14 mx-auto text-primary mb-4" />
              <h1 className="text-2xl font-semibold mb-2">Lançamento enviado!</h1>
              <p className="text-muted-foreground mb-6">
                Recebemos sua solicitação. Após aprovação, ela será registrada no
                financeiro.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setDone(false);
                  setFile(null);
                  setCategoryId("");
                }}
              >
                Enviar outro lançamento
              </Button>
            </Card>
          ) : (
            <Card className="p-6 sm:p-8">
              <header className="mb-6">
                <h1 className="text-2xl font-semibold">Enviar lançamento</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Informe uma entrada ou saída financeira. Sua solicitação passará
                  por aprovação antes de entrar no sistema.
                </p>
              </header>

              {hasAutofill && (
                <div className="mb-4 flex items-center justify-between text-xs bg-muted/40 border rounded-md px-3 py-2">
                  <span className="text-muted-foreground">
                    Preenchemos seus dados da última vez.
                  </span>
                  <button
                    type="button"
                    onClick={clearAutofill}
                    className="text-primary hover:underline"
                  >
                    Limpar
                  </button>
                </div>
              )}

              <form ref={formRef} onSubmit={submit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Seu nome *</Label>
                    <Input id="name" name="name" required maxLength={120} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      maxLength={200}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Tipo *</Label>
                    <Select
                      value={kind}
                      onValueChange={(v) => {
                        setKind(v as "income" | "expense");
                        setCategoryId("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Entrada (receita)</SelectItem>
                        <SelectItem value="expense">Saída (despesa)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="entry_date">Data *</Label>
                    <Input
                      id="entry_date"
                      name="entry_date"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Descrição *</Label>
                  <Input
                    id="description"
                    name="description"
                    required
                    maxLength={200}
                    placeholder="Ex: Pagamento fornecedor X"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="amount">Valor (R$) *</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Categoria</Label>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCats.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                        {filteredCats.length === 0 && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            Nenhuma categoria disponível
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    maxLength={1000}
                    rows={3}
                    placeholder="Informações adicionais..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Comprovante (opcional, máx. 10MB)</Label>
                  {file ? (
                    <div className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                      <span className="truncate">
                        {file.name}{" "}
                        <span className="text-muted-foreground">
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md py-6 cursor-pointer hover:bg-muted/40 transition">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Clique para enviar um arquivo
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          onFileChange(e.target.files);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enviar lançamento
                </Button>
              </form>
            </Card>
          )}

          <p className="text-center text-xs text-muted-foreground mt-6">
            As solicitações são revisadas pela equipe antes de entrarem no
            financeiro.
          </p>
        </div>
      </div>
    </>
  );
}
