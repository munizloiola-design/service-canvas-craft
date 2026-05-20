import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/portal/estrategia")({ component: PortalEstrategia });

type Material = { label: string; url: string };
type Indicador = { nome: string; meta: string; atual: string };
type Briefing = {
  id?: string;
  client_id: string;
  historia: string | null; missao: string | null; visao: string | null; valores: string | null;
  analise_redes: string | null;
  publico_alvo: string | null; persona: string | null; objecoes: string | null; arquetipo: string | null;
  referencias: string | null; concorrencia: string | null; canais: string | null;
  swot_forcas: string | null; swot_fraquezas: string | null; swot_oportunidades: string | null; swot_ameacas: string | null;
  objetivos_mes: string | null;
  materiais: Material[] | null;
  indicadores: Indicador[] | null;
};

function PortalEstrategia() {
  const [clientId, setClientId] = useState<string>("");

  const { data: clients = [] } = useQuery({
    queryKey: ["portal-clients-strategy"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  useEffect(() => {
    if (!clientId && clients.length > 0) setClientId(clients[0].id);
  }, [clients, clientId]);

  const { data: briefing, isFetching } = useQuery({
    queryKey: ["portal-briefing", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase.from("client_briefings" as never).select("*").eq("client_id", clientId).maybeSingle();
      return data as unknown as Briefing | null;
    },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Área Estratégica</h1>
        <p className="text-muted-foreground mt-1">Cadastro estratégico, marca e indicadores.</p>
      </header>

      {clients.length > 1 && (
        <Card className="p-4">
          <Label className="mb-2 block">Cliente</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>
      )}

      {!clientId && <p className="text-sm text-muted-foreground text-center py-12">Nenhum cliente vinculado.</p>}
      {clientId && isFetching && <p className="text-sm text-muted-foreground text-center py-12">Carregando...</p>}
      {clientId && !isFetching && !briefing && (
        <Card className="p-8 text-center text-muted-foreground">Cadastro estratégico ainda não preenchido.</Card>
      )}

      {clientId && briefing && !isFetching && (
        <Card className="p-4">
          <Accordion type="multiple" defaultValue={["empresa"]} className="w-full">
            <AccordionItem value="empresa">
              <AccordionTrigger>Empresa</AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <Block label="História da Empresa" value={briefing.historia} />
                <Block label="Missão" value={briefing.missao} />
                <Block label="Visão" value={briefing.visao} />
                <Block label="Valores" value={briefing.valores} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="redes">
              <AccordionTrigger>Análise das Redes Sociais</AccordionTrigger>
              <AccordionContent className="pt-2">
                <Block label="Diagnóstico atual" value={briefing.analise_redes} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="marca">
              <AccordionTrigger>Estudo da Marca</AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <Block label="Público-Alvo" value={briefing.publico_alvo} />
                <Block label="Persona" value={briefing.persona} />
                <Block label="Principais Objeções" value={briefing.objecoes} />
                <Block label="Arquétipo" value={briefing.arquetipo} />
                <Block label="Referências" value={briefing.referencias} />
                <Block label="Concorrência" value={briefing.concorrencia} />
                <Block label="Canais de Divulgação" value={briefing.canais} />

                {briefing.materiais && briefing.materiais.length > 0 && (
                  <div className="space-y-1">
                    <Label>Materiais da Marca</Label>
                    <ul className="space-y-1">
                      {briefing.materiais.map((m, i) => (
                        <li key={i} className="text-sm">
                          <a href={m.url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                            {m.label || m.url} <ExternalLink className="h-3 w-3" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="swot">
              <AccordionTrigger>Análise SWOT</AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <SwotCard color="emerald" label="Forças" value={briefing.swot_forcas} />
                  <SwotCard color="rose" label="Fraquezas" value={briefing.swot_fraquezas} />
                  <SwotCard color="sky" label="Oportunidades" value={briefing.swot_oportunidades} />
                  <SwotCard color="amber" label="Ameaças" value={briefing.swot_ameacas} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="objetivos">
              <AccordionTrigger>Objetivos do Mês</AccordionTrigger>
              <AccordionContent className="pt-2">
                <Block label="Metas e prioridades" value={briefing.objetivos_mes} />
              </AccordionContent>
            </AccordionItem>

            {briefing.indicadores && briefing.indicadores.length > 0 && (
              <AccordionItem value="indicadores">
                <AccordionTrigger>Indicadores</AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="border rounded-md divide-y">
                    <div className="grid grid-cols-[1fr_100px_100px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                      <span>Indicador</span><span>Meta</span><span>Atual</span>
                    </div>
                    {briefing.indicadores.map((ind, i) => (
                      <div key={i} className="grid grid-cols-[1fr_100px_100px] gap-2 px-3 py-2 text-sm">
                        <span>{ind.nome}</span><span>{ind.meta}</span><span>{ind.atual}</span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </Card>
      )}
    </div>
  );
}

function Block({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <p className="text-sm whitespace-pre-wrap text-foreground/90">{value}</p>
    </div>
  );
}

function SwotCard({ color, label, value }: { color: "emerald" | "rose" | "sky" | "amber"; label: string; value: string | null }) {
  const styles: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-400",
    sky: "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-400",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400",
  };
  return (
    <div className={`rounded-md border p-3 space-y-1 ${styles[color]}`}>
      <Label className="text-inherit">{label}</Label>
      <p className="text-sm whitespace-pre-wrap text-foreground/90">{value || "—"}</p>
    </div>
  );
}
