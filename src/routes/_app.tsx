import { createFileRoute, Outlet, Navigate, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { usePermissions, type Resource } from "@/lib/permissions";
import { useAccess } from "@/lib/access-context";
import { useBranding } from "@/lib/branding-context";
import { LayoutDashboard, FolderKanban, Users, Users2, LogOut, Briefcase, Settings, DollarSign, Calculator, Wrench, CalendarDays, ShieldCheck, Facebook, Sparkles, Plug, Inbox, Palette, Menu, ChevronDown, Building2, Clock, PanelLeftClose, PanelLeft, BarChart3, ClipboardCheck, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; resource: Resource; masterOnly?: boolean };
type NavGroup = { label?: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  { items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, resource: "dashboard" }] },
  {
    label: "Operação",
    items: [
      { to: "/projects", label: "Projetos", icon: FolderKanban, resource: "projects" },
      { to: "/tickets", label: "Tickets", icon: Inbox, resource: "tickets" },
      { to: "/calendario", label: "Calendário", icon: CalendarDays, resource: "calendario" },
      { to: "/clientes-area", label: "Área do Cliente", icon: Building2, resource: "clientes_area" },
      { to: "/equipamentos", label: "Equipamentos", icon: Wrench, resource: "equipamentos" },
      { to: "/tempo", label: "Tempo", icon: Clock, resource: "time_reports" },
      { to: "/parceiros", label: "Parceiros", icon: Handshake, resource: "parceiros" },
    ],

  },
  {
    label: "Financeiro",
    items: [
      { to: "/financeiro", label: "Financeiro", icon: DollarSign, resource: "financeiro" },
      { to: "/orcamento", label: "Orçamento", icon: Calculator, resource: "orcamento" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { to: "/facebook", label: "Facebook Ads", icon: Facebook, resource: "facebook" },
      { to: "/diguinho", label: "Diguinho IA", icon: Sparkles, resource: "diguinho" },
    ],
  },
  {
    label: "Squad",
    items: [
      { to: "/team", label: "Equipe", icon: Users, resource: "team" },
      { to: "/squad", label: "Times", icon: Users2, resource: "clientes_area" },
      { to: "/squad/relatorio", label: "Relatório", icon: BarChart3, resource: "clientes_area" },
      { to: "/aprovacoes", label: "Aprovações", icon: ClipboardCheck, resource: "aprovacoes" },
      { to: "/acessos", label: "Perfis e Acessos", icon: ShieldCheck, resource: "cadastros", masterOnly: true },
    ],
  },
  {
    label: "Configurações",
    items: [
      { to: "/cadastros", label: "Cadastros", icon: Settings, resource: "cadastros" },
      { to: "/integracoes", label: "Integrações", icon: Plug, resource: "integracoes" },
      { to: "/personalizacao", label: "Personalização", icon: Palette, resource: "branding" },
    ],
  },
];

function AppLayout() {
  const { user, loading, signOut, roles, isClient, isMaster } = useAuth();
  const { branding } = useBranding();
  const { can, loading: permsLoading } = usePermissions();
  const { menuAllowed, loading: accessLoading } = useAccess();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("sidebar:collapsed") === "1";
  });
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sidebar:collapsed", desktopCollapsed ? "1" : "0");
    }
  }, [desktopCollapsed]);

  if (loading || permsLoading || accessLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (isClient) return <Navigate to="/portal/calendario" />;

  const visibleGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (item.masterOnly && !isMaster) return false;
        if (!can(item.resource, "view")) return false;
        return menuAllowed(item.to);
      }),
    }))
    .filter((g) => g.items.length > 0);

  const initials = (user.email ?? "U").slice(0, 2).toUpperCase();
  const primaryRole = roles[0] ?? "membro";

  const SidebarContent = (
    <>
      <div className="px-4 py-5 flex items-center justify-between border-b border-sidebar-border">
        <div className="flex items-center gap-2 min-w-0">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt="logo" className="h-8 w-8 rounded-md object-contain" />
          ) : (
            <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
              <Briefcase className="h-4 w-4" />
            </div>
          )}
          <span className="font-semibold truncate">{branding.brand_name}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDesktopCollapsed((v) => !v)}
          className="hidden md:inline-flex h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
          aria-label={desktopCollapsed ? "Mostrar menu" : "Esconder menu"}
          title={desktopCollapsed ? "Mostrar menu" : "Esconder menu"}
        >
          {desktopCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {visibleGroups.map((group, idx) => {
          const renderLink = (item: NavItem, indented = false) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  indented ? "ml-2" : ""
                } ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          };

          if (!group.label) {
            return <div key={`g-${idx}`} className="space-y-1">{group.items.map((i) => renderLink(i))}</div>;
          }

          const groupActive = group.items.some((i) => pathname.startsWith(i.to));
          return (
            <Collapsible key={group.label} defaultOpen={groupActive}>
              <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
                <span>{group.label}</span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=closed]:-rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-1">
                {group.items.map((i) => renderLink(i, true))}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.email}</p>
            <Badge variant="secondary" className="text-[10px] capitalize mt-0.5">{primaryRole}</Badge>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start"
          onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </div>
    </>
  );

  const sidebarStyle = branding.sidebar_color
    ? ({
        backgroundColor: `color-mix(in srgb, ${branding.sidebar_color} 65%, transparent)`,
      } as React.CSSProperties)
    : undefined;

  return (
    <div className="min-h-screen flex">
      <aside
        style={sidebarStyle}
        className={`hidden md:flex shrink-0 border-r border-white/30 dark:border-white/10 bg-white/55 dark:bg-white/5 backdrop-blur-xl text-sidebar-foreground flex-col overflow-hidden transition-[width] duration-200 shadow-[0_8px_32px_0_rgba(15,23,42,0.05)] ${
          desktopCollapsed ? "w-0 border-r-0" : "w-64"
        }`}
      >
        {SidebarContent}
      </aside>

      {/* Floating sidebar trigger — always visible on desktop, especially when collapsed */}
      {desktopCollapsed && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDesktopCollapsed(false)}
          aria-label="Mostrar menu"
          title="Mostrar menu"
          className="hidden md:inline-flex fixed top-3 left-3 z-50 h-9 w-9 rounded-full shadow-lg glass"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Mobile topbar */}
      <header
        style={sidebarStyle}
        className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white/55 dark:bg-white/5 backdrop-blur-xl text-sidebar-foreground border-b border-white/30 dark:border-white/10 flex items-center justify-between px-3"
      >
        <div className="flex items-center gap-2">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt="logo" className="h-7 w-7 rounded-md object-contain" />
          ) : (
            <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
              <Briefcase className="h-4 w-4" />
            </div>
          )}
          <span className="font-semibold text-sm truncate">{branding.brand_name}</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" style={sidebarStyle} className="p-0 w-72 text-sidebar-foreground flex flex-col">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              {SidebarContent}
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 overflow-auto pt-14 md:pt-0 min-w-0">
        {/* Desktop top-right theme toggle */}
        <div className="hidden md:flex justify-end px-4 pt-3">
          <ThemeToggle />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
