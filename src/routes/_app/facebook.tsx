import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Facebook, RefreshCw } from "lucide-react";
import { getMetaInsights } from "@/lib/facebook.functions";

export const Route = createFileRoute("/_app/facebook")({ component: FacebookPage });

const PRESETS = [
  { v: "today", l: "Hoje" },
  { v: "yesterday", l: "Ontem" },
  { v: "last_7d", l: "Últimos 7 dias" },
  { v: "last_30d", l: "Últimos 30 dias" },
  { v: "this_month", l: "Este mês" },
];

function fmtMoney(n: any) {
  const v = Number(n ?? 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtNum(n: any) {
  return Number(n ?? 0).toLocaleString("pt-BR");
}

function FacebookPage() {
  const fn = useServerFn(getMetaInsights);
  const [preset, setPreset] = useState("last_7d");
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["meta-insights", preset],
    queryFn: () => fn({ data: { date_preset: preset } }),
  });

  if (!isLoading && data && !data.connected) {
    return (
      <div className="p-4 md:p-8 max-w-2xl">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-[#1877F2]/10 text-[#1877F2] flex items-center justify-center">
              <Facebook className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Conecte o Facebook Business</h2>
              <p className="text-sm text-muted-foreground">Você ainda não conectou sua conta de anúncios.</p>
            </div>
            <Button asChild><Link to="/integracoes">Ir para Integrações</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = data?.summary as any;
  const actions: any[] = s?.actions ?? [];
  const conv = actions.find((a) => a.action_type === "offsite_conversion" || a.action_type === "lead")?.value;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Facebook className="h-6 w-6 text-[#1877F2]" /> Facebook Ads</h1>
          <p className="text-sm text-muted-foreground">{data?.account_name ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{PRESETS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {data?.error && (
        <Card className="border-destructive/50"><CardContent className="py-4 text-sm text-destructive">{data.error}</CardContent></Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Investimento" value={fmtMoney(s?.spend)} />
        <KPI label="Impressões" value={fmtNum(s?.impressions)} />
        <KPI label="Cliques" value={fmtNum(s?.clicks)} />
        <KPI label="CTR" value={s?.ctr ? `${Number(s.ctr).toFixed(2)}%` : "—"} />
        <KPI label="CPC médio" value={fmtMoney(s?.cpc)} />
        <KPI label="Alcance" value={fmtNum(s?.reach)} />
        <KPI label="Conversões" value={conv ? fmtNum(conv) : "—"} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Campanhas</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !data?.campaigns?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada.</p>
          ) : (
            <div className="space-y-2">
              {data.campaigns.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between border rounded-md p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{c.name}</span>
                      <Badge variant={c.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px]">{c.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{c.objective}</div>
                  </div>
                  <div className="flex gap-6 text-xs text-right">
                    <div><div className="text-muted-foreground">Gasto</div><div className="font-medium">{fmtMoney(c.insights?.spend)}</div></div>
                    <div><div className="text-muted-foreground">Impr.</div><div className="font-medium">{fmtNum(c.insights?.impressions)}</div></div>
                    <div><div className="text-muted-foreground">CTR</div><div className="font-medium">{c.insights?.ctr ? `${Number(c.insights.ctr).toFixed(2)}%` : "—"}</div></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="py-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </CardContent></Card>
  );
}
