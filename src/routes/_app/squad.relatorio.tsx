import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Users2, Download, Clock, FolderKanban, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { describeSupabaseError } from "@/lib/supabase-error";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

type SearchParams = { from?: string; to?: string; team?: string; member?: string };

function isoDay(d: Date) { return d.toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return isoDay(d); }
function formatHours(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
function toHours(seconds: number) { return Math.round((seconds / 3600) * 100) / 100; }

export const Route = createFileRoute("/_app/squad/relatorio")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    from: typeof s.from === "string" ? s.from : undefined,
    to: typeof s.to === "string" ? s.to : undefined,
    team: typeof s.team === "string" ? s.team : undefined,
    member: typeof s.member === "string" ? s.member : undefined,
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

function SquadRelatorioPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const from = search.from ?? daysAgo(30);
  const to = search.to ?? isoDay(new Date());
  const teamFilter = search.team ?? "";
  const memberFilter = search.member ?? "";

  const setSearch = (patch: Partial<SearchParams>) =>
    navigate({ to: "/squad/relatorio", search: (prev: SearchParams) => ({ ...prev, ...patch }) });

  const teamsQ = useQuery({
    queryKey: ["rel_teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const teams = teamsQ.data ?? [];
  const profilesQ = useQuery({
    queryKey: ["rel_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const profiles = profilesQ.data ?? [];
  const membershipsQ = useQuery({
    queryKey: ["rel_team_members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("team_id, user_id");
      if (error) throw error;
      return data ?? [];
    },
  });
  const memberships = membershipsQ.data ?? [];
  const clientsQ = useQuery({
    queryKey: ["rel_clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name, team_id");
      if (error) throw error;
      return data ?? [];
    },
  });
  const clients = clientsQ.data ?? [];
  const projectsQ = useQuery({
    queryKey: ["rel_projects_min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, title, client_id").order("title");
      if (error) throw error;
      return data ?? [];
    },
  });
  const projects = projectsQ.data ?? [];

  const teamMap = useMemo(() => new Map(teams.map((t: any) => [t.id, t.name])), [teams]);
  const userMap = useMemo(() => new Map(profiles.map((p: any) => [p.id, p.full_name || "Sem nome"])), [profiles]);
  const projectMap = useMemo(() => new Map(projects.map((p: any) => [p.id, p])), [projects]);
  const clientToTeam = useMemo(() => new Map(clients.map((c: any) => [c.id, c.team_id])), [clients]);

  const teamUserIds = useMemo(() => {
    if (!teamFilter) return null;
    return memberships.filter((m: any) => m.team_id === teamFilter).map((m: any) => m.user_id as string);
  }, [memberships, teamFilter]);

  const teamMembersOptions = useMemo(() => {
    const ids = teamFilter
      ? memberships.filter((m: any) => m.team_id === teamFilter).map((m: any) => m.user_id)
      : profiles.map((p: any) => p.id);
    return Array.from(new Set(ids)).map((id) => ({ id, name: userMap.get(id) ?? "—" }));
  }, [memberships, profiles, teamFilter, userMap]);

  const logsQ = useQuery({
    queryKey: ["squad_report_logs", from, to, teamFilter, memberFilter, teamUserIds?.join(",")],
    queryFn: async () => {
      if (teamFilter && teamUserIds && teamUserIds.length === 0) return [] as Row[];
      let q = supabase
        .from("time_logs_with_duration")
        .select("id, project_id, user_id, started_at, ended_at, duration_seconds")
        .gte("started_at", `${from}T00:00:00Z`)
        .lte("started_at", `${to}T23:59:59Z`)
        .order("started_at", { ascending: false });
      if (memberFilter) q = q.eq("user_id", memberFilter);
      else if (teamFilter && teamUserIds && teamUserIds.length > 0) q = q.in("user_id", teamUserIds);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const logs = logsQ.data ?? [];
  const isLoading = logsQ.isLoading;

  const queryErrors = useMemo(() => {
    const list: { label: string; error: unknown }[] = [];
    if (teamsQ.error) list.push({ label: "teams", error: teamsQ.error });
    if (profilesQ.error) list.push({ label: "profiles", error: profilesQ.error });
    if (membershipsQ.error) list.push({ label: "team_members", error: membershipsQ.error });
    if (clientsQ.error) list.push({ label: "clients", error: clientsQ.error });
    if (projectsQ.error) list.push({ label: "projects", error: projectsQ.error });
    if (logsQ.error) list.push({ label: "time_logs_with_duration", error: logsQ.error });
    return list;
  }, [teamsQ.error, profilesQ.error, membershipsQ.error, clientsQ.error, projectsQ.error, logsQ.error]);

  useEffect(() => {
    for (const { label, error } of queryErrors) {
      console.error(`[squad-relatorio:${label}]`, error);
      toast.error(`Falha em ${label}: ${describeSupabaseError(error)}`);
    }
  }, [queryErrors]);

  const closed = useMemo(() => logs.filter((l) => l.ended_at && (l.duration_seconds ?? 0) > 0), [logs]);

  // Aggregation by team (via project.client.team_id)
  const byTeam = useMemo(() => {
    const map = new Map<string, { seconds: number; sessions: number; users: Set<string> }>();
    for (const l of closed) {
      const proj: any = projectMap.get(l.project_id);
      const tId = proj ? clientToTeam.get(proj.client_id) ?? "__none" : "__none";
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
  }, [closed, projectMap, clientToTeam, teamMap]);

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

  // Team composition (roster) - not dependent on logs
  const roster = useMemo(() => {
    const teamsList = teamFilter ? teams.filter((t: any) => t.id === teamFilter) : teams;
    return teamsList.map((t: any) => ({
      id: t.id, name: t.name,
      members: memberships.filter((m: any) => m.team_id === t.id).map((m: any) => userMap.get(m.user_id) ?? "—"),
      clients: clients.filter((c: any) => c.team_id === t.id).map((c: any) => c.name),
    }));
  }, [teams, memberships, clients, teamFilter, userMap]);

  const totals = useMemo(() => ({
    seconds: closed.reduce((s, l) => s + (l.duration_seconds ?? 0), 0),
    sessions: closed.length,
    teams: byTeam.length,
    members: byMember.length,
  }), [closed, byTeam, byMember]);

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

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Users2 className="h-6 w-6" /> Relatório de Squad
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Desempenho por equipe (usuários) e por time (agrupamento de clientes).</p>
      </header>

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
          <Button variant="outline" onClick={() => {
            const rows: (string | number)[][] = [["Time", "Sessões", "Colaboradores", "Horas"]];
            for (const t of byTeam) rows.push([t.name, t.sessions, t.users, toHours(t.seconds)]);
            rows.push([]);
            rows.push(["Membro", "Sessões", "Projetos", "Horas"]);
            for (const m of byMember) rows.push([m.name, m.sessions, m.projects, toHours(m.seconds)]);
            exportCSV(rows, `squad_${from}_${to}.csv`);
          }}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi icon={<Clock className="h-4 w-4" />} label="Horas totais" value={formatHours(totals.seconds)} />
        <Kpi icon={<Users2 className="h-4 w-4" />} label="Times ativos" value={String(totals.teams)} />
        <Kpi icon={<Users className="h-4 w-4" />} label="Membros ativos" value={String(totals.members)} />
        <Kpi icon={<FolderKanban className="h-4 w-4" />} label="Sessões" value={String(totals.sessions)} />
      </div>

      {isLoading ? (
        <Card className="p-10 text-center text-muted-foreground">Carregando…</Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Horas por time</h3>
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
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Top membros por horas</h3>
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
            </Card>
          </div>

          <Tabs defaultValue="teams">
            <TabsList>
              <TabsTrigger value="teams">Por time</TabsTrigger>
              <TabsTrigger value="members">Por membro</TabsTrigger>
              <TabsTrigger value="roster">Composição</TabsTrigger>
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
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem registros no período.</TableCell></TableRow>
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
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem registros no período.</TableCell></TableRow>
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
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Clientes atribuídos</p>
                      <div className="flex flex-wrap gap-1">
                        {t.clients.length === 0 ? <span className="text-sm text-muted-foreground">—</span> :
                          t.clients.map((n: string, i: number) => (
                            <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md">{n}</span>
                          ))}
                      </div>
                    </div>
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
