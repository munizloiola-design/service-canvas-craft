import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ThemeJson = {
  primary?: string;
  accent?: string;
  background?: string;
  card?: string;
  chart1?: string;
  chart2?: string;
  chart3?: string;
  chart4?: string;
  chart5?: string;
  chart6?: string;
};

export type LoginBoxPosition = "left" | "center" | "right";

export type Branding = {
  brand_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  accent_color: string;
  sidebar_color: string | null;
  button_color: string | null;
  background_image: string | null;
  login_box_position: LoginBoxPosition;
  welcome_title: string;
  welcome_subtitle: string;
  login_client_label: string;
  login_client_desc: string;
  login_agency_label: string;
  login_agency_desc: string;
  suggestions: string | null;
  theme_json: ThemeJson | null;
};

const DEFAULT: Branding = {
  brand_name: "Equipe.io",
  logo_url: null,
  favicon_url: null,
  primary_color: "#1a936f",
  accent_color: "#0f766e",
  sidebar_color: null,
  button_color: null,
  background_image: null,
  login_box_position: "right",
  welcome_title: "Como deseja entrar?",
  welcome_subtitle: "Escolha o tipo de acesso.",
  login_client_label: "Cliente",
  login_client_desc: "Acesso ao portal de aprovações",
  login_agency_label: "Agência",
  login_agency_desc: "Colaboradores e gestores",
  suggestions: null,
  theme_json: null,
};

const Ctx = createContext<{ branding: Branding; refresh: () => Promise<void> }>({
  branding: DEFAULT,
  refresh: async () => {},
});

function hexToRgb(hex: string) {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULT);

  const load = async () => {
    const { data } = await supabase
      .from("app_branding")
      .select("brand_name, logo_url, favicon_url, primary_color, accent_color, sidebar_color, button_color, background_image, login_box_position, welcome_title, welcome_subtitle, login_client_label, login_client_desc, login_agency_label, login_agency_desc, suggestions, theme_json")
      .eq("id", true)
      .maybeSingle();
    if (data) {
      setBranding({
        ...DEFAULT,
        ...(data as Partial<Branding>),
        login_box_position: ((data as any).login_box_position ?? "right") as LoginBoxPosition,
        welcome_title: (data as any).welcome_title ?? DEFAULT.welcome_title,
        welcome_subtitle: (data as any).welcome_subtitle ?? DEFAULT.welcome_subtitle,
        login_client_label: (data as any).login_client_label ?? DEFAULT.login_client_label,
        login_client_desc: (data as any).login_client_desc ?? DEFAULT.login_client_desc,
        login_agency_label: (data as any).login_agency_label ?? DEFAULT.login_agency_label,
        login_agency_desc: (data as any).login_agency_desc ?? DEFAULT.login_agency_desc,
      });
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = branding.brand_name;
    const root = document.documentElement;
    root.style.setProperty("--brand-primary", hexToRgb(branding.primary_color));
    root.style.setProperty("--brand-accent", hexToRgb(branding.accent_color));
    if (branding.sidebar_color) {
      root.style.setProperty("--brand-sidebar", hexToRgb(branding.sidebar_color));
    } else {
      root.style.removeProperty("--brand-sidebar");
    }

    const t = branding.theme_json ?? {};
    const setVar = (k: string, v?: string) => { if (v) root.style.setProperty(k, v); };
    setVar("--chart-1", t.chart1);
    setVar("--chart-2", t.chart2);
    setVar("--chart-3", t.chart3);
    setVar("--chart-4", t.chart4);
    setVar("--chart-5", t.chart5);
    setVar("--chart-6", t.chart6);

    if (branding.favicon_url) {
      let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = branding.favicon_url;
    }
  }, [branding]);

  return <Ctx.Provider value={{ branding, refresh: load }}>{children}</Ctx.Provider>;
}

export function useBranding() {
  return useContext(Ctx);
}
