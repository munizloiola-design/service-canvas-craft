import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSectionGate } from "@/lib/access-sections";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Users, Users2, Download, Clock, FolderKanban, AlertTriangle,
  Activity, ArrowRightLeft, MessageSquare, Paperclip, Ticket, PlusCircle, Timer,
} from "lucide-react";
import { toast } from "sonner";
import { describeSupabaseError } from "@/lib/supabase-error";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

type ActivityType = "time" | "status" | "comment" | "attachment" | "ticket";
const ALL_TYPES: ActivityType[] = ["time", "status", "comment", "attachment", "ticket"];

type SearchParams = { from?: string; to?: string; team?: string; member?: string; types?: string };

function isoDay(d: Date) { return d.toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return isoDay(d); }
function formatHours(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
function toHours(seconds: number) { return Math.round((seconds / 3600) * 100) / 100; }
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export const Route = createFileRoute("/_app/squad/relatorio")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    from: typeof s.from === "string" ? s.from : undefined,
    to: typeof s.to === "string" ? s.to : undefined,
    team: typeof s.team === "string" ? s.team : undefined,
    member: typeof s.member === "string" ? s.member : undefined,
    types: typeof s.types === "string" ? s.types : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Relatório de Squad" },
      { name: "description", content: "Relatório de equipes e times com filtros." },
    ],
  }),
  component: SquadRelatorioPage,
});

type Row = {
  id: string; project_id: string; user_id: string;
  started_at: string; ended_at: string | null; duration_seconds: number | null;
};

type ActivityEvent = {
  id: string;
  type: ActivityType;
  at: string;
  user_id: string | null;
  project_id: string | null;
  label: string;
  detail?: string;
};

function SquadRelatorioPage() {
  const sec = useSectionGate("/squad/relatorio");
  const navigate = useNavigate();
  const search = Route.useSearch();
  const from = search.from ?? daysAgo(30);
  const to = search.to ?? isoDay(new Date());
  const teamFilter = search.team ?? "";
  const memberFilter = search.member ?? "";
  const selectedTypes = useMemo<ActivityType[]>(() => {
    if (!search.types) return ALL_TYPES;
    const arr = search.types.split(",").filter((t: string): t is ActivityType => (ALL_TYPES as string[]).includes(t));
    return arr.length ? arr : ALL_TYPES;
  }, [search.types]);

  const setSearch = (patch: Partial<SearchParams>) =>
    navigate({ to: "/squad/relatorio", search: (prev: SearchParams) => ({ ...prev, ...patch }) });

  const toggleType = (t: ActivityType) => {
    const set = new Set(selectedTypes);
    if (set.has(t)) set.delete(t); else set.add(t);
    const next = Array.from(set);
    setSearch({ types: next.length === 0 || next.length === ALL_TYPES.length ? undefined : next.join(",") });
  };

  const teamsQ = useQuery({
    queryKey: ["rel_teams"],
    queryFn: async () => (await supabase.from("teams").select("id, name").order("name")).data ?? [],
  });
  const teams = teamsQ.data ?? [];
  const profilesQ = useQuery({
    queryKey: ["rel_profiles"],
    queryFn: async () => (await supabase.from("internal_profiles").select("id, full_name").order("full_name")).data ?? [],
  });
  const profiles = profilesQ.data ?? [];
  const membershipsQ = useQuery({
    queryKey: ["rel_team_members"],
    queryFn: async () => (await supabase.from("team_members").select("team_id, user_id")).data ?? [],
  });
  const memberships = membershipsQ.data ?? [];
  const clientsQ = useQuery({
    queryKey: ["rel_clients"],
    queryFn: async () => (await supabase.from("clients").select("id, name")).data ?? [],
  });
  const clients = clientsQ.data ?? [];
  const projectsQ = useQuery({
    queryKey: ["rel_projects_min"],
    queryFn: async () => (await supabase.from("projects").select("id, title, client_id, team_id").order("title")).data ?? [],
  });
  const projects = projectsQ.data ?? [];
  const statusesQ = useQuery({
    queryKey: ["rel_statuses"],
    queryFn: async () => (await supabase.from("workflow_statuses").select("id, name")).data ?? [],
  });
  const statuses = statusesQ.data ?? [];

  const teamMap = useMemo(() => new Map(teams.map((t: any) => [t.id, t.name])), [teams]);
  const userMap = useMemo(() => new Map(profiles.map((p: any) => [p.id, p.full_name || "Sem nome"])), [profiles]);
  const projectMap = useMemo(() => new Map(projects.map((p: any) => [p.id, p])), [projects]);
  const clientMap = useMemo(() => new Map(clients.map((c: any) => [c.id, c])), [clients]);
  const statusMap = useMemo(() => new Map(statuses.map((s: any) => [s.id, s.name])), [statuses]);

  const teamUserIds = useMemo(() => {
    if (!teamFilter) return null;
    return memberships.filter((m: any) => m.team_id === teamFilter).map((m: any) => m.user_id as string);
  }, [memberships, teamFilter]);

  const teamProjectIds = useMemo(() => {
    if (!teamFilter) return null;
    return projects.filter((p: any) => p.team_id === teamFilter).map((p: any) => p.id as string);
  }, [projects, teamFilter]);


  const teamMembersOptions = useMemo(() => {
    const ids = teamFilter
      ? memberships.filter((m: any) => m.team_id === teamFilter).map((m: any) => m.user_id)
      : profiles.map((p: any) => p.id);
    return Array.from(new Set(ids)).map((id) => ({ id, name: userMap.get(id) ?? "—" }));
  }, [memberships, profiles, teamFilter, userMap]);

  const fromIso = `${from}T00:00:00Z`;
  const toIso = `${to}T23:59:59Z`;

  const logsQ = useQuery({
    queryKey: ["squad_report_logs", from, to, teamFilter, memberFilter, teamUserIds?.join(",")],
    queryFn: async () => {
      if (teamFilter && teamUserIds && teamUserIds.length === 0) return [] as Row[];
      let q = supabase
        .from("time_logs_with_duration")
        .select("id, project_id, user_id, started_at, ended_at, duration_seconds")
        .gte("started_at", fromIso).lte("started_at", toIso)
        .order("started_at", { ascending: false });
      if (memberFilter) q = q.eq("user_id", memberFilter);
      else if (teamFilter && teamUserIds && teamUserIds.length > 0) q = q.in("user_id", teamUserIds);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const logs = logsQ.data ?? [];

  const transitionsQ = useQuery({
    queryKey: ["squad_report_transitions", from, to, teamFilter, memberFilter, teamProjectIds?.join(","), teamUserIds?.join(",")],
    enabled: selectedTypes.includes("status"),
    queryFn: async () => {
      let q = supabase.from("project_transitions")
        .select("id, project_id, from_status_id, to_status_id, changed_by, reason, created_at")
        .gte("created_at", fromIso).lte("created_at", toIso)
        .order("created_at", { ascending: false });
      if (memberFilter) q = q.eq("changed_by", memberFilter);
      else if (teamUserIds && teamUserIds.length > 0) q = q.in("changed_by", teamUserIds);
      if (teamProjectIds) {
        if (teamProjectIds.length === 0) return [];
        q = q.in("project_id", teamProjectIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  const commentsQ = useQuery({
    queryKey: ["squad_report_comments", from, to, teamFilter, memberFilter, teamProjectIds?.join(","), teamUserIds?.join(",")],
    enabled: selectedTypes.includes("comment"),
    queryFn: async () => {
      let q = supabase.from("project_comments")
        .select("id, project_id, author_id, content, created_at")
        .gte("created_at", fromIso).lte("created_at", toIso)
        .order("created_at", { ascending: false });
      if (memberFilter) q = q.eq("author_id", memberFilter);
      else if (teamUserIds && teamUserIds.length > 0) q = q.in("author_id", teamUserIds);
      if (teamProjectIds) {
        if (teamProjectIds.length === 0) return [];
        q = q.in("project_id", teamProjectIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  const attachmentsQ = useQuery({
    queryKey: ["squad_report_attachments", from, to, teamFilter, memberFilter, teamProjectIds?.join(","), teamUserIds?.join(",")],
    enabled: selectedTypes.includes("attachment"),
    queryFn: async () => {
      let q = supabase.from("project_attachments")
        .select("id, project_id, file_name, uploaded_by, created_at")
        .gte("created_at", fromIso).lte("created_at", toIso)
        .order("created_at", { ascending: false });
      if (memberFilter) q = q.eq("uploaded_by", memberFilter);
      else if (teamUserIds && teamUserIds.length > 0) q = q.in("uploaded_by", teamUserIds);
      if (teamProjectIds) {
        if (teamProjectIds.length === 0) return [];
        q = q.in("project_id", teamProjectIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  const ticketsQ = useQuery({
    queryKey: ["squad_report_tickets", from, to],
    enabled: selectedTypes.includes("ticket"),
    queryFn: async () => {
      const { data, error } = await supabase.from("ticket_requests")
        .select("id, title, requester_name, status, reviewed_by, reviewed_at, created_at, created_project_id")
        .or(`and(created_at.gte.${fromIso},created_at.lte.${toIso}),and(reviewed_at.gte.${fromIso},reviewed_at.lte.${toIso})`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const isLoading = logsQ.isLoading;

  const queryErrors = useMemo(() => {
    const list: { label: string; error: unknown }[] = [];
    if (teamsQ.error) list.push({ label: "teams", error: teamsQ.error });
    if (profilesQ.error) list.push({ label: "profiles", error: profilesQ.error });
    if (membershipsQ.error) list.push({ label: "team_members", error: membershipsQ.error });
    if (clientsQ.error) list.push({ label: "clients", error: clientsQ.error });
    if (projectsQ.error) list.push({ label: "projects", error: projectsQ.error });
    if (logsQ.error) list.push({ label: "time_logs_with_duration", error: logsQ.error });
    if (transitionsQ.error) list.push({ label: "project_transitions", error: transitionsQ.error });
    if (commentsQ.error) list.push({ label: "project_comments", error: commentsQ.error });
    if (attachmentsQ.error) list.push({ label: "project_attachments", error: attachmentsQ.error });
    if (ticketsQ.error) list.push({ label: "ticket_requests", error: ticketsQ.error });
    return list;
  }, [teamsQ.error, profilesQ.error, membershipsQ.error, clientsQ.error, projectsQ.error, logsQ.error, transitionsQ.error, commentsQ.error, attachmentsQ.error, ticketsQ.error]);

  useEffect(() => {
    for (const { label, error } of queryErrors) {
      console.error(`[squad-relatorio:${label}]`, error);
      toast.error(`Falha em ${label}: ${describeSupabaseError(error)}`);
    }
  }, [queryErrors]);

  const closed = useMemo(() => logs.filter((l) => l.ended_at && (l.duration_seconds ?? 0) > 0), [logs]);

  const byTeam = useMemo(() => {
    const map = new Map<string, { seconds: number; sessions: number; users: Set<string> }>();
    for (const l of closed) {
      const proj: any = projectMap.get(l.project_id);
      const tId = proj?.team_id ?? "__none";
      const cur = map.get(tId) ?? { seconds: 0, sessions: 0, users: new Set<string>() };
      cur.seconds += l.duration_seconds ?? 0;
      cur.sessions += 1;
      cur.users.add(l.user_id);
      map.set(tId, cur);
    }
    return Array.from(map.entries()).map(([id, v]) => ({
      id, name: id === "__none" ? "Sem time" : (teamMap.get(id) ?? "—"),
      seconds: v.seconds, sessions: v.sessions, users: v.users.size,
    })).sort((a, b) => b.seconds - a.seconds);
  }, [closed, projectMap, teamMap]);


  const byMember = useMemo(() => {
    const map = new Map<string, { seconds: number; sessions: number; projects: Set<string> }>();
    for (const l of closed) {
      const cur = map.get(l.user_id) ?? { seconds: 0, sessions: 0, projects: new Set<string>() };
      cur.seconds += l.duration_seconds ?? 0;
      cur.sessions += 1;
      cur.projects.add(l.project_id);
      map.set(l.user_id, cur);
    }
    return Array.from(map.entries()).map(([id, v]) => ({
      id, name: userMap.get(id) ?? "—",
      seconds: v.seconds, sessions: v.sessions, projects: v.projects.size,
    })).sort((a, b) => b.seconds - a.seconds);
  }, [closed, userMap]);

  const roster = useMemo(() => {
    const teamsList = teamFilter ? teams.filter((t: any) => t.id === teamFilter) : teams;
    return teamsList.map((t: any) => {
      const teamProjects = projects.filter((p: any) => p.team_id === t.id);
      const clientIds = Array.from(new Set(teamProjects.map((p: any) => p.client_id).filter(Boolean)));
      return {
        id: t.id,
        name: t.name,
        members: memberships.filter((m: any) => m.team_id === t.id).map((m: any) => userMap.get(m.user_id) ?? "—"),
        projects: teamProjects.map((p: any) => p.title as string),
        clients: clientIds.map((cid: any) => clientMap.get(cid)?.name ?? "—"),
      };
    });
  }, [teams, memberships, projects, teamFilter, userMap, clientMap]);


  // ==== Activities timeline ====
  const activities = useMemo<ActivityEvent[]>(() => {
    const evts: ActivityEvent[] = [];
    if (selectedTypes.includes("time")) {
      for (const l of closed) {
        evts.push({
          id: `time-${l.id}`, type: "time", at: l.ended_at ?? l.started_at,
          user_id: l.user_id, project_id: l.project_id,
          label: `Registrou ${formatHours(l.duration_seconds ?? 0)}`,
          detail: `Início ${fmtDateTime(l.started_at)}`,
        });
      }
    }
    if (selectedTypes.includes("status")) {
      for (const t of (transitionsQ.data ?? [])) {
        const fromN = t.from_status_id ? statusMap.get(t.from_status_id) ?? "—" : "início";
        const toN = t.to_status_id ? statusMap.get(t.to_status_id) ?? "—" : "—";
        evts.push({
          id: `status-${t.id}`, type: "status", at: t.created_at,
          user_id: t.changed_by, project_id: t.project_id,
          label: `Moveu status: ${fromN} → ${toN}`,
          detail: t.reason ?? undefined,
        });
      }
    }
    if (selectedTypes.includes("comment")) {
      for (const c of (commentsQ.data ?? [])) {
        evts.push({
          id: `comment-${c.id}`, type: "comment", at: c.created_at,
          user_id: c.author_id, project_id: c.project_id,
          label: "Comentou",
          detail: c.content.length > 140 ? c.content.slice(0, 140) + "…" : c.content,
        });
      }
    }
    if (selectedTypes.includes("attachment")) {
      for (const a of (attachmentsQ.data ?? [])) {
        evts.push({
          id: `att-${a.id}`, type: "attachment", at: a.created_at,
          user_id: a.uploaded_by, project_id: a.project_id,
          label: `Anexou "${a.file_name}"`,
        });
      }
    }
    if (selectedTypes.includes("ticket")) {
      for (const t of (ticketsQ.data ?? [])) {
        evts.push({
          id: `tk-open-${t.id}`, type: "ticket", at: t.created_at,
          user_id: null, project_id: t.created_project_id,
          label: `Ticket aberto por ${t.requester_name}`,
          detail: t.title,
        });
        if (t.reviewed_at && t.reviewed_by) {
          evts.push({
            id: `tk-rev-${t.id}`, type: "ticket", at: t.reviewed_at,
            user_id: t.reviewed_by, project_id: t.created_project_id,
            label: `Ticket ${t.status}: ${t.title}`,
          });
        }
      }
    }
    return evts.sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [selectedTypes, closed, transitionsQ.data, commentsQ.data, attachmentsQ.data, ticketsQ.data, statusMap]);

  const activityCounts = useMemo(() => {
    const c: Record<ActivityType, number> = { time: 0, status: 0, comment: 0, attachment: 0, ticket: 0 };
    for (const e of activities) c[e.type] += 1;
    return c;
  }, [activities]);

  const totals = useMemo(() => ({
    seconds: closed.reduce((s, l) => s + (l.duration_seconds ?? 0), 0),
    sessions: closed.length,
    teams: byTeam.length,
    members: byMember.length,
    activities: activities.length,
  }), [closed, byTeam, byMember, activities]);

  const teamChart = byTeam.map((t) => ({ name: t.name.length > 18 ? t.name.slice(0, 18) + "…" : t.name, horas: toHours(t.seconds) }));
  const memberChart = byMember.slice(0, 10).map((m) => ({ name: m.name, horas: toHours(m.seconds) }));

  const exportCSV = (rows: (string | number)[][], filename: string) => {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportSummary = () => {
    const rows: (string | number)[][] = [["Time", "Sessões", "Colaboradores", "Horas"]];
    for (const t of byTeam) rows.push([t.name, t.sessions, t.users, toHours(t.seconds)]);
    rows.push([]);
    rows.push(["Membro", "Sessões", "Projetos", "Horas"]);
    for (const m of byMember) rows.push([m.name, m.sessions, m.projects, toHours(m.seconds)]);
    exportCSV(rows, `squad_${from}_${to}.csv`);
  };

  const exportActivities = () => {
    const rows: (string | number)[][] = [["Quando", "Tipo", "Membro", "Projeto", "Cliente", "Descrição", "Detalhe"]];
    for (const e of activities) {
      const proj: any = e.project_id ? projectMap.get(e.project_id) : null;
      const cli: any = proj?.client_id ? clientMap.get(proj.client_id) : null;
      rows.push([
        fmtDateTime(e.at), e.type,
        e.user_id ? (userMap.get(e.user_id) ?? "—") : "—",
        proj?.title ?? "—", cli?.name ?? "—",
        e.label, e.detail ?? "",
      ]);
    }
    exportCSV(rows, `squad_atividades_${from}_${to}.csv`);
  };

  // ==== Empty-state onboarding ====
  const noTeams = teams.length === 0;
  const noMembers = memberships.length === 0;
  const noSessions = closed.length === 0;
  const noActivity = activities.length === 0;
  const showOnboarding = !isLoading && noTeams && noMembers && noSessions && noActivity;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold flex items-center gap-2 text-gradient">
          <Users2 className="h-6 w-6" /> Relatório de Squad
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Desempenho por equipe (usuários), time (agrupamento de clientes) e atividades do período.</p>
      </header>

      {queryErrors.length > 0 && (
        <Card className="p-4 border-destructive/50 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-destructive">Falha ao carregar dados do relatório</p>
              <ul className="list-disc pl-4 text-destructive/90 space-y-0.5">
                {queryErrors.map((q) => (
                  <li key={q.label}><span className="font-mono">{q.label}</span>: {describeSupabaseError(q.error)}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 grid gap-3 md:grid-cols-5">
        <div className="space-y-1.5">
          <Label>De</Label>
          <Input type="date" value={from} onChange={(e) => setSearch({ from: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Até</Label>
          <Input type="date" value={to} onChange={(e) => setSearch({ to: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Time</Label>
          <Select value={teamFilter || "__all"} onValueChange={(v) => setSearch({ team: v === "__all" ? undefined : v, member: undefined })}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os times</SelectItem>
              {teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Membro</Label>
          <Select value={memberFilter || "__all"} onValueChange={(v) => setSearch({ member: v === "__all" ? undefined : v })}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os membros</SelectItem>
              {teamMembersOptions.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 flex flex-col justify-end">
          <Button variant="outline" onClick={exportSummary}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-5">
        <Kpi icon={<Clock className="h-4 w-4" />} label="Horas totais" value={formatHours(totals.seconds)} />
        <Kpi icon={<Users2 className="h-4 w-4" />} label="Times ativos" value={String(totals.teams)} />
        <Kpi icon={<Users className="h-4 w-4" />} label="Membros ativos" value={String(totals.members)} />
        <Kpi icon={<FolderKanban className="h-4 w-4" />} label="Sessões" value={String(totals.sessions)} />
        <Kpi icon={<Activity className="h-4 w-4" />} label="Atividades" value={String(totals.activities)} />
      </div>

      {isLoading ? (
        <Card className="p-10 text-center text-muted-foreground">Carregando…</Card>
      ) : showOnboarding ? (
        <OnboardingCard />
      ) : (
        <>
          {(byTeam.length > 0 || byMember.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Horas por time</h3>
                {teamChart.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={teamChart} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis type="category" dataKey="name" width={140} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="horas" fill="hsl(var(--chart-1))" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Top membros por horas</h3>
                {memberChart.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={memberChart} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis type="category" dataKey="name" width={140} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="horas" fill="hsl(var(--chart-2))" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>
          )}

          <Tabs defaultValue={sec.first(noSessions ? ["activities", "teams", "members", "roster"] : ["teams", "members", "activities", "roster"])}>
            <TabsList>
              {sec.can("teams") && <TabsTrigger value="teams">Por time</TabsTrigger>}
              {sec.can("members") && <TabsTrigger value="members">Por membro</TabsTrigger>}
              {sec.can("activities") && <TabsTrigger value="activities">Atividades</TabsTrigger>}
              {sec.can("roster") && <TabsTrigger value="roster">Composição</TabsTrigger>}
            </TabsList>

            <TabsContent value="teams" className="mt-4">
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Sessões</TableHead>
                      <TableHead className="text-right">Colaboradores</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byTeam.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem sessões de tempo no período.</TableCell></TableRow>
                    ) : byTeam.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-right">{t.sessions}</TableCell>
                        <TableCell className="text-right">{t.users}</TableCell>
                        <TableCell className="text-right font-semibold">{formatHours(t.seconds)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="members" className="mt-4">
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Membro</TableHead>
                      <TableHead className="text-right">Sessões</TableHead>
                      <TableHead className="text-right">Projetos</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byMember.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem sessões de tempo no período.</TableCell></TableRow>
                    ) : byMember.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell className="text-right">{m.sessions}</TableCell>
                        <TableCell className="text-right">{m.projects}</TableCell>
                        <TableCell className="text-right font-semibold">{formatHours(m.seconds)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="activities" className="mt-4 space-y-4">
              <Card className="p-4 flex flex-wrap items-center gap-2 justify-between">
                <div className="flex flex-wrap gap-2">
                  <TypeToggle t="time" active={selectedTypes.includes("time")} onClick={toggleType} count={activityCounts.time} label="Tempo" icon={<Timer className="h-3 w-3" />} />
                  <TypeToggle t="status" active={selectedTypes.includes("status")} onClick={toggleType} count={activityCounts.status} label="Status" icon={<ArrowRightLeft className="h-3 w-3" />} />
                  <TypeToggle t="comment" active={selectedTypes.includes("comment")} onClick={toggleType} count={activityCounts.comment} label="Comentários" icon={<MessageSquare className="h-3 w-3" />} />
                  <TypeToggle t="attachment" active={selectedTypes.includes("attachment")} onClick={toggleType} count={activityCounts.attachment} label="Anexos" icon={<Paperclip className="h-3 w-3" />} />
                  <TypeToggle t="ticket" active={selectedTypes.includes("ticket")} onClick={toggleType} count={activityCounts.ticket} label="Tickets" icon={<Ticket className="h-3 w-3" />} />
                </div>
                <Button variant="outline" size="sm" onClick={exportActivities} disabled={activities.length === 0}>
                  <Download className="h-4 w-4 mr-2" /> Exportar CSV
                </Button>
              </Card>

              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Quando</TableHead>
                      <TableHead className="w-28">Tipo</TableHead>
                      <TableHead>Membro</TableHead>
                      <TableHead>Projeto / Cliente</TableHead>
                      <TableHead>Descrição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma atividade no período com os filtros atuais.</TableCell></TableRow>
                    ) : activities.slice(0, 300).map((e) => {
                      const proj: any = e.project_id ? projectMap.get(e.project_id) : null;
                      const cli: any = proj?.client_id ? clientMap.get(proj.client_id) : null;
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(e.at)}</TableCell>
                          <TableCell><TypeBadge t={e.type} /></TableCell>
                          <TableCell className="text-sm">{e.user_id ? (userMap.get(e.user_id) ?? "—") : "—"}</TableCell>
                          <TableCell className="text-sm">
                            {proj ? (
                              <div>
                                <div className="font-medium">{proj.title}</div>
                                {cli && <div className="text-xs text-muted-foreground">{cli.name}</div>}
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>{e.label}</div>
                            {e.detail && <div className="text-xs text-muted-foreground mt-0.5">{e.detail}</div>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {activities.length > 300 && (
                  <div className="p-2 text-center text-xs text-muted-foreground border-t">
                    Mostrando as 300 atividades mais recentes de {activities.length}. Refine os filtros para ver mais.
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="roster" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                {roster.length === 0 ? (
                  <Card className="p-6 text-center text-muted-foreground md:col-span-2">Nenhum time cadastrado.</Card>
                ) : roster.map((t) => (
                  <Card key={t.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center gap-2"><Users2 className="h-4 w-4" /> {t.name}</h4>
                      <span className="text-xs text-muted-foreground">{t.members.length} membros</span>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Membros</p>
                      <div className="flex flex-wrap gap-1">
                        {t.members.length === 0 ? <span className="text-sm text-muted-foreground">—</span> :
                          t.members.map((n: string, i: number) => (
                            <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-md">{n}</span>
                          ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Projetos do time</p>
                      <div className="flex flex-wrap gap-1">
                        {t.projects.length === 0 ? <span className="text-sm text-muted-foreground">Nenhuma demanda vinculada.</span> :
                          t.projects.slice(0, 12).map((n: string, i: number) => (
                            <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md">{n}</span>
                          ))}
                        {t.projects.length > 12 && (
                          <span className="text-xs text-muted-foreground">+{t.projects.length - 12}</span>
                        )}
                      </div>
                    </div>
                    {t.clients.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Clientes atendidos</p>
                        <div className="flex flex-wrap gap-1">
                          {t.clients.map((n: string, i: number) => (
                            <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-md">{n}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </TabsContent>

          </Tabs>
        </>
      )}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </Card>
  );
}

function EmptyChart() {
  return <div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">Sem dados no período.</div>;
}

function TypeToggle({ t, active, onClick, count, label, icon }: {
  t: ActivityType; active: boolean; onClick: (t: ActivityType) => void; count: number; label: string; icon: React.ReactNode;
}) {
  return (
    <Button size="sm" variant={active ? "default" : "outline"} onClick={() => onClick(t)} className="gap-1.5">
      {icon}{label}
      <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{count}</Badge>
    </Button>
  );
}

function TypeBadge({ t }: { t: ActivityType }) {
  const map: Record<ActivityType, { label: string; icon: React.ReactNode; cls: string }> = {
    time:       { label: "Tempo",     icon: <Timer className="h-3 w-3" />,          cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    status:     { label: "Status",    icon: <ArrowRightLeft className="h-3 w-3" />, cls: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
    comment:    { label: "Comentário",icon: <MessageSquare className="h-3 w-3" />,  cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    attachment: { label: "Anexo",     icon: <Paperclip className="h-3 w-3" />,      cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    ticket:     { label: "Ticket",    icon: <Ticket className="h-3 w-3" />,         cls: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
  };
  const it = map[t];
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${it.cls}`}>{it.icon}{it.label}</span>;
}

function OnboardingCard() {
  return (
    <Card className="p-8">
      <div className="text-center max-w-xl mx-auto space-y-3">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users2 className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold">Nada para relatar ainda</h2>
        <p className="text-sm text-muted-foreground">
          Este relatório consolida horas registradas, mudanças de status, comentários, anexos e tickets do time.
          Comece cadastrando um time, adicionando membros e registrando tempo em projetos.
        </p>
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          <Button asChild>
            <Link to="/squad"><PlusCircle className="h-4 w-4 mr-2" /> Criar time</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/squad"><Users className="h-4 w-4 mr-2" /> Adicionar membros</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/tempo"><Timer className="h-4 w-4 mr-2" /> Registrar tempo</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
