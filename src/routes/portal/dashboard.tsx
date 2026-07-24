import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, addDays, isAfter, isBefore, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, ClipboardCheck, CheckCircle2, Target, Clock, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/portal/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel do Cliente" },
      { name: "description", content: "Resumo dos seus projetos, aprovações pendentes e próximas entregas." },
    ],
  }),
  component: PortalDashboard,
});

type P = {
  id: string;
  title: string;
  due_date: string | null;
  post_date: string | null;
  status_id: string | null;
  client_decision: string | null;
  updated_at: string | null;
};

type S = { id: string; name: string; color: string | null; is_client_validation: boolean; is_final: boolean };

function PortalDashboard() {
  const { data: projects = [] } = useQuery({
    queryKey: ["portal-dashboard-projects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, title, due_date, post_date, status_id, client_decision, updated_at");
      return (data ?? []) as P[];
    },
  });
  const { data: statuses = [] } = useQuery({
    queryKey: ["workflow_statuses_all"],
    queryFn: async () =>
      ((await supabase.from("workflow_statuses").select("id, name, color, is_client_validation, is_final")).data ??
        []) as S[],
  });

  const stats = useMemo(() => {
    const validationIds = new Set(statuses.filter((s) => s.is_client_validation).map((s) => s.id));
    const finalIds = new Set(statuses.filter((s) => s.is_final).map((s) => s.id));
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const in7 = addDays(now, 7);

    const pending = projects.filter((p) => p.status_id && validationIds.has(p.status_id) && !p.client_decision);
    const approvedThisMonth = projects.filter((p) => {
      if (p.client_decision !== "aprovado" && !(p.status_id && finalIds.has(p.status_id))) return false;
      const ref = p.updated_at ? parseISO(p.updated_at) : null;
      return ref && !isBefore(ref, monthStart) && !isAfter(ref, monthEnd);
    });
    const upcoming = projects
      .filter((p) => {
        const d = p.post_date ?? p.due_date;
        if (!d) return false;
        const dt = parseISO(d);
        return !isBefore(dt, now) && !isAfter(dt, in7);
      })
      .sort((a, b) => (a.post_date ?? a.due_date ?? "").localeCompare(b.post_date ?? b.due_date ?? ""));

    return { pending, approvedThisMonth, upcoming };
  }, [projects, statuses]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-gradient">Seu painel</h1>
        <p className="text-muted-foreground mt-1">
          Um resumo rápido dos seus projetos, aprovações e próximas entregas.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          to="/portal/pendentes"
          icon={ClipboardCheck}
          label="Pendentes de aprovação"
          value={stats.pending.length}
          tint="from-amber-500/20 to-orange-500/10"
        />
        <StatCard
          to="/portal/aprovados"
          icon={CheckCircle2}
          label="Aprovados neste mês"
          value={stats.approvedThisMonth.length}
          tint="from-emerald-500/20 to-teal-500/10"
        />
        <StatCard
          to="/portal/calendario"
          icon={Clock}
          label="Entregas nos próximos 7 dias"
          value={stats.upcoming.length}
          tint="from-sky-500/20 to-indigo-500/10"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 glass">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Aprovações pendentes</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal/pendentes">
                Ver todas <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
          {stats.pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada aguardando sua aprovação. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {stats.pending.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    {p.due_date && (
                      <p className="text-xs text-muted-foreground">
                        Entrega {format(parseISO(p.due_date), "dd/MM", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0">Aguardando</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 glass">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Próximas entregas</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal/calendario">
                Calendário <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
          {stats.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma entrega marcada para os próximos 7 dias.</p>
          ) : (
            <ul className="space-y-2">
              {stats.upcoming.slice(0, 5).map((p) => {
                const d = p.post_date ?? p.due_date!;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.post_date ? "Postagem" : "Entrega"} em{" "}
                        {format(parseISO(d), "dd 'de' MMM", { locale: ptBR })}
                      </p>
                    </div>
                    <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-5 glass">
        <h2 className="font-semibold mb-3">Atalhos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ShortcutLink to="/portal/calendario" icon={CalendarDays} label="Calendário" />
          <ShortcutLink to="/portal/pendentes" icon={ClipboardCheck} label="Pendentes" />
          <ShortcutLink to="/portal/aprovados" icon={CheckCircle2} label="Aprovados" />
          <ShortcutLink to="/portal/estrategia" icon={Target} label="Estratégia" />
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  to,
  icon: Icon,
  label,
  value,
  tint,
}: {
  to: string;
  icon: typeof CalendarDays;
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <Link to={to} className="block group">
      <Card className={`p-5 glass bg-gradient-to-br ${tint} transition-transform group-hover:-translate-y-0.5`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-semibold mt-1">{value}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-background/60 flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </Card>
    </Link>
  );
}

function ShortcutLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof CalendarDays;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 hover:bg-muted transition-colors text-sm font-medium"
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
