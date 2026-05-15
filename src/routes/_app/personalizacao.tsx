import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/lib/branding-context";
import { usePermissions } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Upload, Palette } from "lucide-react";

export const Route = createFileRoute("/_app/personalizacao")({
  component: PersonalizacaoPage,
});

type EmailTpl = { id: string; key: string; subject: string; body_html: string };

function PersonalizacaoPage() {
  const { can, loading: pLoading } = usePermissions();
  const { branding, refresh } = useBranding();

  const [brandName, setBrandName] = useState(branding.brand_name);
  const [logoUrl, setLogoUrl] = useState(branding.logo_url ?? "");
  const [faviconUrl, setFaviconUrl] = useState(branding.favicon_url ?? "");
  const [primary, setPrimary] = useState(branding.primary_color);
  const [accent, setAccent] = useState(branding.accent_color);
  const [suggestions, setSuggestions] = useState(branding.suggestions ?? "");
  const [savingB, setSavingB] = useState(false);

  const [templates, setTemplates] = useState<EmailTpl[]>([]);
  const [savingT, setSavingT] = useState<string | null>(null);

  useEffect(() => {
    setBrandName(branding.brand_name);
    setLogoUrl(branding.logo_url ?? "");
    setFaviconUrl(branding.favicon_url ?? "");
    setPrimary(branding.primary_color);
    setAccent(branding.accent_color);
    setSuggestions(branding.suggestions ?? "");
  }, [branding]);

  useEffect(() => {
    supabase.from("email_templates").select("*").order("key")
      .then(({ data }) => setTemplates((data ?? []) as EmailTpl[]));
  }, []);

  if (pLoading) return <div className="p-8">Carregando...</div>;
  if (!can("branding" as any, "manage")) return <Navigate to="/dashboard" />;

  const upload = async (file: File, kind: "logo" | "favicon") => {
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${kind}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("brand-assets").upload(path, file, {
      contentType: file.type, upsert: true,
    });
    if (up.error) { toast.error(up.error.message); return; }
    const { data } = supabase.storage.from("brand-assets").getPublicUrl(path);
    if (kind === "logo") setLogoUrl(data.publicUrl);
    else setFaviconUrl(data.publicUrl);
    toast.success(`${kind === "logo" ? "Logo" : "Favicon"} enviado`);
  };

  const saveBranding = async () => {
    setSavingB(true);
    try {
      const { error } = await supabase.from("app_branding").upsert({
        id: true,
        brand_name: brandName.trim() || "Equipe.io",
        logo_url: logoUrl || null,
        favicon_url: faviconUrl || null,
        primary_color: primary,
        accent_color: accent,
        suggestions: suggestions || null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      await refresh();
      toast.success("Personalização salva");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSavingB(false);
    }
  };

  const saveTemplate = async (t: EmailTpl) => {
    setSavingT(t.id);
    try {
      const { error } = await supabase
        .from("email_templates")
        .update({ subject: t.subject, body_html: t.body_html, updated_at: new Date().toISOString() })
        .eq("id", t.id);
      if (error) throw error;
      toast.success("Template salvo");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar template");
    } finally {
      setSavingT(null);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Palette className="h-6 w-6" /> Personalização
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Identidade visual do sistema e templates de e-mail.
        </p>
      </header>

      <Tabs defaultValue="brand">
        <TabsList>
          <TabsTrigger value="brand">Marca</TabsTrigger>
          <TabsTrigger value="emails">Templates de e-mail</TabsTrigger>
        </TabsList>

        <TabsContent value="brand" className="mt-4">
          <Card className="p-6 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="brand_name">Nome do sistema</Label>
              <Input id="brand_name" value={brandName} onChange={(e) => setBrandName(e.target.value)} maxLength={80} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Logo</Label>
                <div className="flex items-center gap-3">
                  {logoUrl && <img src={logoUrl} alt="logo" className="h-10 w-10 rounded object-contain border" />}
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm border rounded-md px-3 py-2 hover:bg-muted/40">
                    <Upload className="h-4 w-4" /> Enviar imagem
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "logo")} />
                  </label>
                  {logoUrl && <Button variant="ghost" size="sm" onClick={() => setLogoUrl("")}>Remover</Button>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Favicon</Label>
                <div className="flex items-center gap-3">
                  {faviconUrl && <img src={faviconUrl} alt="favicon" className="h-8 w-8 rounded object-contain border" />}
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm border rounded-md px-3 py-2 hover:bg-muted/40">
                    <Upload className="h-4 w-4" /> Enviar imagem
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "favicon")} />
                  </label>
                  {faviconUrl && <Button variant="ghost" size="sm" onClick={() => setFaviconUrl("")}>Remover</Button>}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="primary">Cor primária</Label>
                <div className="flex gap-2 items-center">
                  <Input id="primary" type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-14 p-1" />
                  <Input value={primary} onChange={(e) => setPrimary(e.target.value)} className="font-mono" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accent">Cor de destaque</Label>
                <div className="flex gap-2 items-center">
                  <Input id="accent" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-14 p-1" />
                  <Input value={accent} onChange={(e) => setAccent(e.target.value)} className="font-mono" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="suggestions">Sugestões / observações de marca</Label>
              <Textarea id="suggestions" rows={4} maxLength={2000}
                placeholder="Ex: tom de voz amigável, evitar uso de roxo escuro, slogan 'Criatividade que entrega'..."
                value={suggestions} onChange={(e) => setSuggestions(e.target.value)} />
            </div>

            <Button onClick={saveBranding} disabled={savingB}>
              {savingB && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar personalização
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="emails" className="mt-4 space-y-4">
          <Card className="p-4 bg-muted/30 text-xs">
            Variáveis disponíveis nos templates: <code>{"{{requester_name}}"}</code>, <code>{"{{title}}"}</code>, <code>{"{{review_notes}}"}</code>, <code>{"{{brand_name}}"}</code>
          </Card>
          {templates.map((t) => (
            <Card key={t.id} className="p-5 space-y-3">
              <div>
                <h3 className="font-semibold">
                  {t.key === "ticket_approved" ? "✓ Ticket aprovado" : "✗ Ticket recusado"}
                </h3>
                <p className="text-xs text-muted-foreground">Enviado para o e-mail do solicitante.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Assunto</Label>
                <Input value={t.subject} onChange={(e) => setTemplates(templates.map((x) => x.id === t.id ? { ...x, subject: e.target.value } : x))} />
              </div>
              <div className="space-y-1.5">
                <Label>Corpo (HTML)</Label>
                <Textarea rows={8} className="font-mono text-xs" value={t.body_html}
                  onChange={(e) => setTemplates(templates.map((x) => x.id === t.id ? { ...x, body_html: e.target.value } : x))} />
              </div>
              <Button size="sm" onClick={() => saveTemplate(t)} disabled={savingT === t.id}>
                {savingT === t.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
