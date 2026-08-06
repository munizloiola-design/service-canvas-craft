import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBranding, type LoginBoxPosition } from "@/lib/branding-context";
import { useAccess } from "@/lib/access-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Loader2, Upload, Palette, Image as ImageIcon, Type, Mail, PaintBucket } from "lucide-react";

export const Route = createFileRoute("/_app/personalizacao")({
  component: PersonalizacaoPage,
});

type EmailTpl = { id: string; key: string; subject: string; body_html: string };

const CHART_KEYS = [
  { key: "chart1", label: "Gráfico 1 (primária)" },
  { key: "chart2", label: "Gráfico 2" },
  { key: "chart3", label: "Gráfico 3" },
  { key: "chart4", label: "Gráfico 4" },
  { key: "chart5", label: "Gráfico 5" },
  { key: "chart6", label: "Gráfico 6" },
] as const;

const INVOME_PRESET = {
  chart1: "#1a936f",
  chart2: "#38bdf8",
  chart3: "#f97316",
  chart4: "#a855f7",
  chart5: "#ec4899",
  chart6: "#eab308",
};

function PersonalizacaoPage() {
  const { menuAllowed } = useAccess();
  const { branding, refresh } = useBranding();

  const [brandName, setBrandName] = useState(branding.brand_name);
  const [logoUrl, setLogoUrl] = useState(branding.logo_url ?? "");
  const [faviconUrl, setFaviconUrl] = useState(branding.favicon_url ?? "");
  const [primary, setPrimary] = useState(branding.primary_color);
  const [accent, setAccent] = useState(branding.accent_color);
  const [sidebar, setSidebar] = useState(branding.sidebar_color ?? branding.primary_color);
  const [buttonColor, setButtonColor] = useState(branding.button_color ?? branding.primary_color);
  const [bgImage, setBgImage] = useState(branding.background_image ?? "");
  const [boxPos, setBoxPos] = useState<LoginBoxPosition>(branding.login_box_position);
  const [welcomeTitle, setWelcomeTitle] = useState(branding.welcome_title);
  const [welcomeSubtitle, setWelcomeSubtitle] = useState(branding.welcome_subtitle);
  const [clientLabel, setClientLabel] = useState(branding.login_client_label);
  const [clientDesc, setClientDesc] = useState(branding.login_client_desc);
  const [agencyLabel, setAgencyLabel] = useState(branding.login_agency_label);
  const [agencyDesc, setAgencyDesc] = useState(branding.login_agency_desc);
  const [suggestions, setSuggestions] = useState(branding.suggestions ?? "");
  const [theme, setTheme] = useState<Record<string, string>>({
    ...INVOME_PRESET,
    ...(branding.theme_json ?? {}),
  });
  const [saving, setSaving] = useState(false);

  const [templates, setTemplates] = useState<EmailTpl[]>([]);
  const [savingT, setSavingT] = useState<string | null>(null);

  useEffect(() => {
    setBrandName(branding.brand_name);
    setLogoUrl(branding.logo_url ?? "");
    setFaviconUrl(branding.favicon_url ?? "");
    setPrimary(branding.primary_color);
    setAccent(branding.accent_color);
    setSidebar(branding.sidebar_color ?? branding.primary_color);
    setButtonColor(branding.button_color ?? branding.primary_color);
    setBgImage(branding.background_image ?? "");
    setBoxPos(branding.login_box_position);
    setWelcomeTitle(branding.welcome_title);
    setWelcomeSubtitle(branding.welcome_subtitle);
    setClientLabel(branding.login_client_label);
    setClientDesc(branding.login_client_desc);
    setAgencyLabel(branding.login_agency_label);
    setAgencyDesc(branding.login_agency_desc);
    setSuggestions(branding.suggestions ?? "");
    setTheme({ ...INVOME_PRESET, ...(branding.theme_json ?? {}) });
  }, [branding]);

  useEffect(() => {
    supabase.from("email_templates").select("*").order("key")
      .then(({ data }) => setTemplates((data ?? []) as EmailTpl[]));
  }, []);

  if (!menuAllowed("/personalizacao")) return <Navigate to="/dashboard" />;

  const upload = async (file: File, kind: "logo" | "favicon" | "background") => {
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${kind}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("brand-assets").upload(path, file, {
      contentType: file.type, upsert: true,
    });
    if (up.error) { toast.error(up.error.message); return; }
    const { data } = supabase.storage.from("brand-assets").getPublicUrl(path);
    if (kind === "logo") setLogoUrl(data.publicUrl);
    else if (kind === "favicon") setFaviconUrl(data.publicUrl);
    else setBgImage(data.publicUrl);
    toast.success("Imagem enviada");
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("app_branding").upsert({
        id: true,
        brand_name: brandName.trim() || "Dig.Workflow",
        logo_url: logoUrl || null,
        favicon_url: faviconUrl || null,
        primary_color: primary,
        accent_color: accent,
        sidebar_color: sidebar || null,
        button_color: buttonColor || null,
        background_image: bgImage || null,
        login_box_position: boxPos,
        welcome_title: welcomeTitle.trim() || "Como deseja entrar?",
        welcome_subtitle: welcomeSubtitle.trim() || "Escolha o tipo de acesso.",
        login_client_label: clientLabel.trim() || "Cliente",
        login_client_desc: clientDesc.trim() || "Acesso ao portal de aprovações",
        login_agency_label: agencyLabel.trim() || "Agência",
        login_agency_desc: agencyDesc.trim() || "Colaboradores e gestores",
        suggestions: suggestions || null,
        theme_json: theme,
        updated_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
      await refresh();
      toast.success("Personalização salva");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
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
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Palette className="h-6 w-6" /> Identidade &amp; Aparência
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Centralize toda a identidade visual do sistema em um só lugar.
        </p>
      </header>

      {/* Marca & Ícones */}
      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Marca &amp; Ícones</h2>
        </div>
        <Separator />
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
      </Card>

      {/* Paleta de Cores */}
      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <PaintBucket className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Paleta de Cores</h2>
        </div>
        <Separator />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ColorPicker label="Cor primária" value={primary} onChange={setPrimary} />
          <ColorPicker label="Cor de destaque" value={accent} onChange={setAccent} />
          <ColorPicker label="Cor do menu lateral" value={sidebar} onChange={setSidebar} />
          <ColorPicker label="Cor dos botões" value={buttonColor} onChange={setButtonColor} />
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Cores dos gráficos</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {CHART_KEYS.map((c) => (
              <ColorPicker
                key={c.key}
                label={c.label}
                value={theme[c.key] ?? "#000000"}
                onChange={(v) => setTheme((prev) => ({ ...prev, [c.key]: v }))}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* Tela de Login */}
      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Type className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Tela de Login</h2>
        </div>
        <Separator />
        <div className="space-y-1.5">
          <Label>Imagem de fundo</Label>
          <div className="flex items-center gap-3">
            {bgImage && (
              <img src={bgImage} alt="fundo" className="h-16 w-24 rounded object-cover border" />
            )}
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm border rounded-md px-3 py-2 hover:bg-muted/40">
              <Upload className="h-4 w-4" /> Enviar imagem
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "background")} />
            </label>
            {bgImage && <Button variant="ghost" size="sm" onClick={() => setBgImage("")}>Remover</Button>}
          </div>
          <p className="text-xs text-muted-foreground">Sem imagem, o painel verde padrão é exibido.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Posição da caixa de login</Label>
          <RadioGroup value={boxPos} onValueChange={(v) => setBoxPos(v as LoginBoxPosition)} className="grid grid-cols-3 gap-3">
            {(["left","center","right"] as const).map((pos) => (
              <label key={pos} className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <RadioGroupItem value={pos} id={`pos-${pos}`} />
                <span className="text-sm capitalize">
                  {pos === "left" ? "Esquerda" : pos === "center" ? "Centro" : "Direita"}
                </span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="wt">Título de boas-vindas</Label>
            <Input id="wt" value={welcomeTitle} onChange={(e) => setWelcomeTitle(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws">Subtítulo</Label>
            <Input id="ws" value={welcomeSubtitle} onChange={(e) => setWelcomeSubtitle(e.target.value)} maxLength={140} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Rótulo do cartão "Cliente"</Label>
            <Input value={clientLabel} onChange={(e) => setClientLabel(e.target.value)} maxLength={40} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição do cartão "Cliente"</Label>
            <Input value={clientDesc} onChange={(e) => setClientDesc(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label>Rótulo do cartão "Agência"</Label>
            <Input value={agencyLabel} onChange={(e) => setAgencyLabel(e.target.value)} maxLength={40} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição do cartão "Agência"</Label>
            <Input value={agencyDesc} onChange={(e) => setAgencyDesc(e.target.value)} maxLength={120} />
          </div>
        </div>

        {/* Live preview */}
        <div className="rounded-xl border p-4 bg-muted/30">
          <p className="text-xs text-muted-foreground mb-3">Prévia da tela de login</p>
          <div className="text-center space-y-1 mb-3">
            <p className="text-lg font-semibold">{welcomeTitle}</p>
            <p className="text-xs text-muted-foreground">{welcomeSubtitle}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3 bg-card">
              <p className="text-sm font-medium">{clientLabel}</p>
              <p className="text-xs text-muted-foreground">{clientDesc}</p>
            </div>
            <div className="rounded-lg border p-3 bg-card">
              <p className="text-sm font-medium">{agencyLabel}</p>
              <p className="text-xs text-muted-foreground">{agencyDesc}</p>
            </div>
          </div>
          <button
            type="button"
            className="mt-3 w-full rounded-md text-white text-sm py-2"
            style={{ background: buttonColor }}
          >
            Entrar
          </button>
        </div>
      </Card>

      {/* Observações de marca */}
      <Card className="p-6 space-y-3">
        <Label htmlFor="suggestions" className="text-base font-semibold">Sugestões / observações de marca</Label>
        <Textarea id="suggestions" rows={3} maxLength={2000}
          placeholder="Ex: tom de voz amigável, evitar uso de roxo escuro, slogan 'Criatividade que entrega'..."
          value={suggestions} onChange={(e) => setSuggestions(e.target.value)} />
      </Card>

      <div className="sticky bottom-4 z-10">
        <Card className="p-4 flex items-center justify-between shadow-lg">
          <p className="text-sm text-muted-foreground">Salve para aplicar as mudanças em todo o sistema.</p>
          <Button onClick={saveAll} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar personalização
          </Button>
        </Card>
      </div>

      {/* Templates de e-mail */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Templates de e-mail</h2>
        </div>
        <Separator />
        <p className="text-xs text-muted-foreground">
          Variáveis disponíveis: <code>{"{{requester_name}}"}</code>, <code>{"{{title}}"}</code>, <code>{"{{review_notes}}"}</code>, <code>{"{{brand_name}}"}</code>
        </p>
        <Accordion type="single" collapsible className="w-full">
          {templates.map((t) => (
            <AccordionItem key={t.id} value={t.id}>
              <AccordionTrigger className="text-left">
                {t.key === "ticket_approved" ? "✓ Ticket aprovado" : "✗ Ticket recusado"}
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
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
                  Salvar template
                </Button>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </div>
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2 items-center">
        <Input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-14 p-1" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </div>
  );
}
