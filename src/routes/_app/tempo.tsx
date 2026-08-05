import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Download, Users, FolderKanban, Timer } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

type SearchParams = { from?: string; to?: string; project?: string; user?: string; team?: string };

function isoDay(d: Date) { return d.toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return isoDay(d); }

export const Route = createFileRoute("/_app/tempo")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    from: typeof s.from === "string" ? s.from : undefined,
    to: typeof s.to === "string" ? s.to : undefined,
    project: typeof s.project === "string" ? s.project : undefined,
    user: typeof s.user === "string" ? s.user : undefined,
    team: typeof s.team === "string" ? s.team : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Relatório de tempo" },
      { name: "description", content: "Painel de horas trabalhadas por projeto e por usuário." },
    ],
  }),
  component: TempoPage,
});

function formatHours(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
function toHours(seconds: number) { return Math.round((seconds / 3600) * 100) / 100; }

type Row = {
  id: string; project_id: string; user_id: string; status_id: string | null;
  started_at: string; ended_at: string | null; duration_seconds: number | null;
};

function TempoPage() {
  const sec = useSectionGate("/tempo");
  const navigate = useNavigate();
  const search = Route.useSearch();
  const from = search.from ?? daysAgo(30);
  const to = search.to ?? isoDay(new Date());
  const projectFilter = search.project ?? "";
  const userFilter = search.user ?? "";
  const teamFilter = search.team ?? "";

  const setSearch = (patch: Partial<SearchParams>) => {
    navigate({ to: "/tempo", search: (prev: SearchParams) => ({ ...prev, ...patch }) });
  };

  const { data: teams = [] } = useQuery({
    queryKey: ["all_teams_min"],
    queryFn: async () => (await supabase.from("teams").select("id, name").order("name")).data ?? [],
  });

  const { data: teamUserIds = null } = useQuery({
    queryKey: ["team_members_ids", teamFilter],
    enabled: !!teamFilter,
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("user_id").eq("team_id", teamFilter);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.user_id as string);
    },
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["time_logs_report", from, to, projectFilter, userFilter, teamFilter, teamUserIds],
    enabled: !teamFilter || teamUserIds !== null,
    queryFn: async () => {
      if (teamFilter && (!teamUserIds || teamUserIds.length === 0)) return [] as Row[];
      let q = supabase
        .from("time_logs_with_duration")
        .select("id, project_id, user_id, status_id, started_at, ended_at, duration_seconds")
        .gte("started_at", `${from}T00:00:00Z`)
        .lte("started_at", `${to}T23:59:59Z`)
        .order("started_at", { ascending: false });
      if (projectFilter) q = q.eq("project_id", projectFilter);
      if (userFilter) q = q.eq("user_id", userFilter);
      if (teamFilter && teamUserIds && teamUserIds.length > 0) q = q.in("user_id", teamUserIds);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["all_projects_min"],
    queryFn: async () => (await supabase.from("projects").select("id, title").order("title")).data ?? [],
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["all_profiles_min"],
    queryFn: async () => (await supabase.from("internal_profiles").select("id, full_name").order("full_name")).data ?? [],
  });
  const { data: statuses = [] } = useQuery({
    queryKey: ["all_statuses_min"],
    queryFn: async () => (await supabase.from("workflow_statuses").select("id, name, color").order("sort_order")).data ?? [],
  });

  const projectMap = useMemo(() => new Map(projects.map((p: any) => [p.id, p.title])), [projects]);
  const userMap = useMemo(() => new Map(profiles.map((p: any) => [p.id, p.full_name || "Sem nome"])), [profiles]);
  const statusMap = useMemo(() => new Map(statuses.map((s: any) => [s.id, { name: s.name, color: s.color }])), [statuses]);

  const closed = useMemo(() => logs.filter((l) => l.ended_at && (l.duration_seconds ?? 0) > 0), [logs]);
  const running = useMemo(() => logs.filter((l) => !l.ended_at).length, [logs]);

  const totals = useMemo(() => {
    const totalSec = closed.reduce((sum, l) => sum + (l.duration_seconds ?? 0), 0);
    return {
      totalSec,
      sessions: closed.length,
      projects: new Set(closed.map((l) => l.project_id)).size,
      users: new Set(closed.map((l) => l.user_id)).size,
    };
  }, [closed]);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of closed) {
      const day = l.started_at.slice(0, 10);
      map.set(day, (map.get(day) ?? 0) + (l.duration_seconds ?? 0));
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([day, sec]) => ({ day: day.slice(5), horas: toHours(sec) }));
  }, [closed]);

  const byProject = useMemo(() => {
    const map = new Map<string, { seconds: number; sessions: number; users: Set<string>; last: string }>();
    for (const l of closed) {
      const cur = map.get(l.project_id) ?? { seconds: 0, sessions: 0, users: new Set<string>(), last: "" };
      cur.seconds += l.duration_seconds ?? 0;
      cur.sessions += 1;
      cur.users.add(l.user_id);
      if (l.started_at > cur.last) cur.last = l.started_at;
      map.set(l.project_id, cur);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({
        id, title: projectMap.get(id) ?? "—",
        seconds: v.seconds, sessions: v.sessions, users: v.users.size, last: v.last,
      }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [closed, projectMap]);

  const byUser = useMemo(() => {
    const map = new Map<string, { seconds: number; sessions: number; projects: Set<string> }>();
    for (const l of closed) {
      const cur = map.get(l.user_id) ?? { seconds: 0, sessions: 0, projects: new Set<string>() };
      cur.seconds += l.duration_seconds ?? 0;
      cur.sessions += 1;
      cur.projects.add(l.project_id);
      map.set(l.user_id, cur);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({
        id, name: userMap.get(id) ?? "—",
        seconds: v.seconds, sessions: v.sessions,
        projects: v.projects.size,
        avg: v.sessions ? Math.round(v.seconds / v.sessions) : 0,
      }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [closed, userMap]);

  const byStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of closed) {
      const key = l.status_id ?? "sem-etapa";
      map.set(key, (map.get(key) ?? 0) + (l.duration_seconds ?? 0));
    }
    return Array.from(map.entries()).map(([id, sec]) => {
      const meta = id === "sem-etapa" ? null : statusMap.get(id);
      return { id, name: meta?.name ?? "Sem etapa", color: meta?.color ?? "hsl(var(--muted-foreground))", horas: toHours(sec) };
    }).filter((r) => r.horas > 0);
  }, [closed, statusMap]);

  const topProjects = byProject.slice(0, 10).map((p) => ({ title: p.title.length > 22 ? p.title.slice(0, 22) + "…" : p.title, horas: toHours(p.seconds) }));
  const topUsers = byUser.slice(0, 10).map((u) => ({ name: u.name, horas: toHours(u.seconds) }));

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
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2 text-gradient">
            <Clock className="h-6 w-6" /> Relatório de tempo
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Horas trabalhadas por projeto e por usuário.</p>
        </div>
        {running > 0 && (
          <Badge variant="secondary" className="gap-1"><Timer className="h-3 w-3" /> {running} em andamento</Badge>
        )}
      </header>

      <Card className="p-4 grid gap-3 md:grid-cols-6">
        <div className="space-y-1.5">
          <Label>De</Label>
          <Input type="date" value={from} onChange={(e) => setSearch({ from: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Até</Label>
          <Input type="date" value={to} onChange={(e) => setSearch({ to: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Equipe</Label>
          <Select value={teamFilter || "__all"} onValueChange={(v) => setSearch({ team: v === "__all" ? undefined : v })}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas as equipes</SelectItem>
              {teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Projeto</Label>
          <Select value={projectFilter || "__all"} onValueChange={(v) => setSearch({ project: v === "__all" ? undefined : v })}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os projetos</SelectItem>
              {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Usuário</Label>
          <Select value={userFilter || "__all"} onValueChange={(v) => setSearch({ user: v === "__all" ? undefined : v })}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os usuários</SelectItem>
              {profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 flex flex-col justify-end">
          <Button variant="outline" onClick={() => {
            const rows: (string | number)[][] = [["Início", "Fim", "Projeto", "Usuário", "Etapa", "Duração (h)"]];
            for (const l of closed) rows.push([
              new Date(l.started_at).toLocaleString("pt-BR"),
              l.ended_at ? new Date(l.ended_at).toLocaleString("pt-BR") : "",
              projectMap.get(l.project_id) ?? "",
              userMap.get(l.user_id) ?? "",
              (l.status_id && statusMap.get(l.status_id)?.name) ?? "",
              toHours(l.duration_seconds ?? 0),
            ]);
            exportCSV(rows, `tempo_${from}_${to}.csv`);
          }}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi icon={<Clock className="h-4 w-4" />} label="Horas totais" value={formatHours(totals.totalSec)} />
        <Kpi icon={<Timer className="h-4 w-4" />} label="Sessões" value={String(totals.sessions)} />
        <Kpi icon={<FolderKanban className="h-4 w-4" />} label="Projetos" value={String(totals.projects)} />
        <Kpi icon={<Users className="h-4 w-4" />} label="Colaboradores" value={String(totals.users)} />
      </div>

      {isLoading ? (
        <Card className="p-10 text-center text-muted-foreground">Carregando…</Card>
      ) : closed.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Nenhum registro de tempo no período.</Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Horas por dia</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="horas" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Distribuição por etapa</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={byStatus} dataKey="horas" nameKey="name" innerRadius={50} outerRadius={90}>
                    {byStatus.map((s, i) => <Cell key={i} fill={s.color || `hsl(var(--chart-${(i % 6) + 1}))`} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Top 10 projetos</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topProjects} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis type="category" dataKey="title" width={140} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="horas" fill="hsl(var(--chart-2))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Horas por usuário</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topUsers} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis type="category" dataKey="name" width={140} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="horas" fill="hsl(var(--chart-3))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Tabs defaultValue={sec.first(["project", "user", "detail"])}>
            <TabsList>
              {sec.can("project") && <TabsTrigger value="project">Por projeto</TabsTrigger>}
              {sec.can("user") && <TabsTrigger value="user">Por usuário</TabsTrigger>}
              {sec.can("detail") && <TabsTrigger value="detail">Detalhado</TabsTrigger>}
            </TabsList>

            <TabsContent value="project" className="mt-4">
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Projeto</TableHead>
                      <TableHead className="text-right">Sessões</TableHead>
                      <TableHead className="text-right">Colaboradores</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead>Última atividade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byProject.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.title}</TableCell>
                        <TableCell className="text-right">{p.sessions}</TableCell>
                        <TableCell className="text-right">{p.users}</TableCell>
                        <TableCell className="text-right font-semibold">{formatHours(p.seconds)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{p.last ? new Date(p.last).toLocaleString("pt-BR") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="user" className="mt-4">
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead className="text-right">Sessões</TableHead>
                      <TableHead className="text-right">Projetos</TableHead>
                      <TableHead className="text-right">Média/sessão</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byUser.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-right">{u.sessions}</TableCell>
                        <TableCell className="text-right">{u.projects}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{formatHours(u.avg)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatHours(u.seconds)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="detail" className="mt-4">
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead className="text-right">Duração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closed.slice(0, 300).map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm">{new Date(l.started_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-sm">{l.ended_at ? new Date(l.ended_at).toLocaleString("pt-BR") : "—"}</TableCell>
                        <TableCell>{projectMap.get(l.project_id) ?? "—"}</TableCell>
                        <TableCell>{userMap.get(l.user_id) ?? "—"}</TableCell>
                        <TableCell>{(l.status_id && statusMap.get(l.status_id)?.name) ?? "—"}</TableCell>
                        <TableCell className="text-right font-medium">{formatHours(l.duration_seconds ?? 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {closed.length > 300 && (
                  <div className="p-3 text-xs text-muted-foreground text-center border-t">
                    Mostrando 300 de {closed.length} sessões — refine os filtros ou exporte o CSV.
                  </div>
                )}
              </Card>
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
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </Card>
  );
}
