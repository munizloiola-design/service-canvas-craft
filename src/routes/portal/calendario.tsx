import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Link as LinkIcon, Download } from "lucide-react";

export const Route = createFileRoute("/portal/calendario")({ component: PortalCalendario });

type P = { id: string; title: string; description: string | null; due_date: string | null; post_date: string | null; status_id: string | null; client_id: string | null; media_type_id: string | null; client_decision: string | null; deliverable_path: string | null; reference_links: string[] };

function PortalCalendario() {
  const [cursor, setCursor] = useState(new Date());
  const [detail, setDetail] = useState<P | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["portal-projects"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, title, description, due_date, post_date, status_id, client_id, media_type_id, client_decision, deliverable_path, reference_links");
      return (data ?? []) as P[];
    },
  });
  const { data: statuses = [] } = useQuery({
    queryKey: ["workflow_statuses"],
    queryFn: async () => (await supabase.from("workflow_statuses").select("id, name, color")).data as { id: string; name: string; color: string }[] ?? [],
  });

  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);

  const eventsByDate = useMemo(() => {
    const m = new Map<string, P[]>();
    for (const p of projects) {
      const d = p.post_date ?? p.due_date;
      if (!d) continue;
      const k = d.slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return m;
  }, [projects]);

  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const openFile = async (path: string) => {
    const { data } = await supabase.storage.from("project-files").createSignedUrl(path, 60);
    if (data) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Seu planejamento</h1>
        <p className="text-muted-foreground mt-1">Visualize todos os materiais programados.</p>
      </header>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="sm" onClick={() => setCursor((c) => subMonths(c, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-lg font-semibold capitalize">{format(cursor, "MMMM yyyy", { locale: ptBR })}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
            <Button variant="outline" size="sm" onClick={() => setCursor((c) => addMonths(c, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
          {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => (
            <div key={d} className="bg-muted/50 px-2 py-1.5 text-xs font-medium text-center text-muted-foreground">{d}</div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const items = eventsByDate.get(key) ?? [];
            const inMonth = isSameMonth(day, cursor);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={key} className={`bg-card min-h-[100px] p-1.5 flex flex-col gap-1 ${inMonth ? "" : "opacity-40"}`}>
                <span className={`text-xs font-medium ${isToday ? "bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center" : ""}`}>{format(day, "d")}</span>
                <div className="flex-1 space-y-0.5 overflow-hidden">
                  {items.slice(0, 3).map((p) => {
                    const st = p.status_id ? statusMap.get(p.status_id) : null;
                    return (
                      <button key={p.id} onClick={() => setDetail(p)}
                        className="w-full text-left text-[10px] px-1 py-0.5 rounded truncate hover:opacity-80"
                        style={st ? { background: `${st.color}25`, color: st.color } : { background: "var(--muted)" }}>
                        {p.title}
                      </button>
                    );
                  })}
                  {items.length > 3 && <Badge variant="secondary" className="text-[9px] h-4">+{items.length - 3}</Badge>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{detail?.title}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              {detail.description && <p className="whitespace-pre-wrap text-muted-foreground">{detail.description}</p>}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {detail.due_date && <div><span className="text-muted-foreground">Prazo:</span> {new Date(detail.due_date).toLocaleDateString("pt-BR")}</div>}
                {detail.post_date && <div><span className="text-muted-foreground">Postagem:</span> {new Date(detail.post_date).toLocaleDateString("pt-BR")}</div>}
                {detail.client_decision && <div><span className="text-muted-foreground">Status:</span> <strong className="capitalize">{detail.client_decision}</strong></div>}
              </div>
              {detail.reference_links?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Referências</p>
                  <ul className="space-y-1">
                    {detail.reference_links.map((u, i) => (
                      <li key={i}><a href={u} target="_blank" rel="noreferrer" className="text-info hover:underline inline-flex items-center gap-1 break-all"><LinkIcon className="h-3 w-3" />{u}</a></li>
                    ))}
                  </ul>
                </div>
              )}
              {detail.deliverable_path && (
                <Button variant="outline" size="sm" onClick={() => openFile(detail.deliverable_path!)}>
                  <Download className="h-4 w-4 mr-1" /> Baixar material
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
