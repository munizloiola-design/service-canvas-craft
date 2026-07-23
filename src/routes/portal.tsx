import { createFileRoute, Outlet, Navigate, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useBranding } from "@/lib/branding-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Briefcase, CalendarDays, ClipboardCheck, CheckCircle2, LogOut, Target } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/portal")({ component: PortalLayout });

const nav = [
  { to: "/portal/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/portal/pendentes", label: "Pendentes", icon: ClipboardCheck },
  { to: "/portal/aprovados", label: "Aprovados", icon: CheckCircle2 },
  { to: "/portal/estrategia", label: "Área Estratégica", icon: Target },
];

function PortalLayout() {
  const { user, loading, isClient, signOut } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: clients = [] } = useQuery({
    queryKey: ["portal-clients", user?.id],
    enabled: !!user && isClient,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (!isClient) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt="logo" className="h-8 w-8 rounded-md object-contain" />
            ) : (
              <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
                <Briefcase className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold truncate">{branding.brand_name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {clients.length > 0 ? clients.map((c) => c.name).join(", ") : user.email}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
        <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}
                className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
