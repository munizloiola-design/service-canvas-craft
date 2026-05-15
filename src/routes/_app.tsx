import { createFileRoute, Outlet, Navigate, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { usePermissions, type Resource } from "@/lib/permissions";
import { useBranding } from "@/lib/branding-context";
import { LayoutDashboard, FolderKanban, Users, LogOut, Briefcase, Settings, DollarSign, Calculator, Wrench, CalendarDays, ShieldCheck, Facebook, Sparkles, Plug, Inbox, Palette, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const navItems: { to: string; label: string; icon: typeof LayoutDashboard; resource: Resource; adminOnly?: boolean }[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, resource: "dashboard" },
  { to: "/projects", label: "Projetos", icon: FolderKanban, resource: "projects" },
  { to: "/tickets", label: "Tickets", icon: Inbox, resource: "tickets" },
  { to: "/calendario", label: "Calendário", icon: CalendarDays, resource: "calendario" },
  { to: "/financeiro", label: "Financeiro", icon: DollarSign, resource: "financeiro" },
  { to: "/orcamento", label: "Orçamento", icon: Calculator, resource: "orcamento" },
  { to: "/equipamentos", label: "Equipamentos", icon: Wrench, resource: "equipamentos" },
  { to: "/team", label: "Equipe", icon: Users, resource: "team" },
  { to: "/facebook", label: "Facebook Ads", icon: Facebook, resource: "facebook" },
  { to: "/diguinho", label: "Diguinho IA", icon: Sparkles, resource: "diguinho" },
  { to: "/integracoes", label: "Integrações", icon: Plug, resource: "integracoes" },
  { to: "/cadastros", label: "Cadastros", icon: Settings, resource: "cadastros" },
  { to: "/personalizacao", label: "Personalização", icon: Palette, resource: "branding" },
  { to: "/permissoes", label: "Permissões", icon: ShieldCheck, resource: "cadastros", adminOnly: true },
];

function AppLayout() {
  const { user, loading, signOut, roles, hasRole } = useAuth();
  const { branding } = useBranding();
  const { can, loading: permsLoading } = usePermissions();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading || permsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;

  const visibleNav = navItems.filter((item) => {
    if (item.adminOnly && !hasRole("admin")) return false;
    return can(item.resource, "view");
  });

  const initials = (user.email ?? "U").slice(0, 2).toUpperCase();
  const primaryRole = roles[0] ?? "membro";

  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const SidebarContent = (
    <>
      <div className="px-6 py-5 flex items-center gap-2 border-b border-sidebar-border">
        {branding.logo_url ? (
          <img src={branding.logo_url} alt="logo" className="h-8 w-8 rounded-md object-contain" />
        ) : (
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <Briefcase className="h-4 w-4" />
          </div>
        )}
        <span className="font-semibold truncate">{branding.brand_name}</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleNav.map((item) => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
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

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground flex-col">
        {SidebarContent}
      </aside>

      {/* Mobile topbar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-sidebar text-sidebar-foreground border-b border-sidebar-border flex items-center justify-between px-3">
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
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground flex flex-col">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            {SidebarContent}
          </SheetContent>
        </Sheet>
      </header>

      <main className="flex-1 overflow-auto pt-14 md:pt-0 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
