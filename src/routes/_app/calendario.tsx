import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format, isSameMonth, isSameDay, addMonths, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/calendario")({ component: CalendarioPage });

type Project = {
  id: string; title: string; due_date: string | null; post_date: string | null;
  status_id: string | null; client_id: string | null;
};
type Status = { id: string; name: string; color: string };
type Client = { id: string; name: string };

function CalendarioPage() {
  const [tab, setTab] = useState<"due" | "post">("due");
  const [cursor, setCursor] = useState(new Date());
  const navigate = useNavigate();

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-cal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, title, due_date, post_date, status_id, client_id");
      if (error) throw error;
      return data as Project[];
    },
  });
  const { data: statuses = [] } = useQuery({
    queryKey: ["workflow_statuses"],
    queryFn: async () => (await supabase.from("workflow_statuses").select("id, name, color")).data as Status[] ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("id, name")).data as Client[] ?? [],
  });

  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);

  const dateField = tab === "due" ? "due_date" : "post_date";

  const eventsByDate = useMemo(() => {
    const m = new Map<string, Project[]>();
    for (const p of projects) {
      const d = p[dateField];
      if (!d) continue;
      const key = d.slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }
    return m;
  }, [projects, dateField]);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Calendário</h1>
          <p className="text-muted-foreground mt-1">Visão dos prazos e datas de postagem das demandas.</p>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "due" | "post")}>
          <TabsList>
            <TabsTrigger value="due">Prazos</TabsTrigger>
            <TabsTrigger value="post">Postagens</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="sm" onClick={() => setCursor((c) => subMonths(c, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold capitalize">
            {format(cursor, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
            <Button variant="outline" size="sm" onClick={() => setCursor((c) => addMonths(c, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="bg-muted/50 px-2 py-1.5 text-xs font-medium text-center text-muted-foreground">{d}</div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const items = eventsByDate.get(key) ?? [];
            const inMonth = isSameMonth(day, cursor);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={key} className={`bg-card min-h-[100px] p-1.5 flex flex-col gap-1 ${inMonth ? "" : "opacity-40"}`}>
                <span className={`text-xs font-medium ${isToday ? "bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center" : ""}`}>
                  {format(day, "d")}
                </span>
                <div className="flex-1 space-y-0.5 overflow-hidden">
                  {items.slice(0, 3).map((p) => {
                    const st = p.status_id ? statusMap.get(p.status_id) : null;
                    return (
                      <button key={p.id}
                        onClick={() => navigate({ to: "/projects" })}
                        className="w-full text-left text-[10px] px-1 py-0.5 rounded truncate hover:opacity-80"
                        style={st ? { background: `${st.color}25`, color: st.color } : { background: "var(--muted)" }}
                        title={`${p.title}${p.client_id ? ` — ${clientMap.get(p.client_id) ?? ""}` : ""}`}>
                        {p.title}
                      </button>
                    );
                  })}
                  {items.length > 3 && (
                    <Badge variant="secondary" className="text-[9px] h-4">+{items.length - 3}</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
