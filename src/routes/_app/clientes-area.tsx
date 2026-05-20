import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Trash2, Save, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/clientes-area")({ component: ClientesAreaPage });

type Material = { label: string; url: string };
type Indicador = { nome: string; meta: string; atual: string };

type Briefing = {
  id?: string;
  client_id: string;
  historia: string; missao: string; visao: string; valores: string;
  analise_redes: string;
  publico_alvo: string; persona: string; objecoes: string; arquetipo: string;
  referencias: string; concorrencia: string; canais: string;
  objetivos_mes: string;
  materiais: Material[];
  indicadores: Indicador[];
};

const empty = (client_id: string): Briefing => ({
  client_id,
  historia: "", missao: "", visao: "", valores: "",
  analise_redes: "",
  publico_alvo: "", persona: "", objecoes: "", arquetipo: "",
  referencias: "", concorrencia: "", canais: "",
  objetivos_mes: "",
  materiais: [], indicadores: [],
});

function ClientesAreaPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [clientId, setClientId] = useState<string>("");
  const [data, setData] = useState<Briefing | null>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: briefing, isFetching } = useQuery({
    queryKey: ["client_briefing", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase.from("client_briefings" as never).select("*").eq("client_id", clientId).maybeSingle();
      return data as unknown as Briefing | null;
    },
  });

  useEffect(() => {
    if (!clientId) { setData(null); return; }
    setData(briefing ? { ...empty(clientId), ...briefing, materiais: briefing.materiais ?? [], indicadores: briefing.indicadores ?? [] } : empty(clientId));
  }, [briefing, clientId]);

  const save = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const payload = { ...data };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tbl = (supabase.from as any)("client_briefings");
      const { error } = data.id
        ? await tbl.update(payload).eq("id", data.id)
        : await tbl.insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cadastro salvo");
      qc.invalidateQueries({ queryKey: ["client_briefing", clientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isManager) {
    return <div className="p-8"><p className="text-muted-foreground">Apenas administradores e gerentes podem acessar.</p></div>;
  }

  const set = <K extends keyof Briefing>(k: K, v: Briefing[K]) => setData((d) => (d ? { ...d, [k]: v } : d));

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Área do Cliente</h1>
        <p className="text-muted-foreground mt-1">Cadastre as informações estratégicas de cada cliente.</p>
      </header>

      <Card className="p-4 mb-4">
        <Label className="mb-2 block">Cliente</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger><SelectValue placeholder="Selecione um cliente..." /></SelectTrigger>
          <SelectContent>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      {!clientId && <p className="text-sm text-muted-foreground text-center py-12">Selecione um cliente para começar.</p>}

      {clientId && isFetching && <p className="text-sm text-muted-foreground text-center py-12">Carregando...</p>}

      {clientId && data && !isFetching && (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <Card className="p-4">
            <Accordion type="multiple" defaultValue={["empresa"]} className="w-full">
              <AccordionItem value="empresa">
                <AccordionTrigger>Empresa</AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <Field label="História da Empresa" value={data.historia} onChange={(v) => set("historia", v)} />
                  <Field label="Missão" value={data.missao} onChange={(v) => set("missao", v)} />
                  <Field label="Visão" value={data.visao} onChange={(v) => set("visao", v)} />
                  <Field label="Valores" value={data.valores} onChange={(v) => set("valores", v)} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="redes">
                <AccordionTrigger>Análise das Redes Sociais</AccordionTrigger>
                <AccordionContent className="pt-2">
                  <Field label="Diagnóstico atual das redes" value={data.analise_redes} onChange={(v) => set("analise_redes", v)} rows={5} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="marca">
                <AccordionTrigger>Estudo da Marca</AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <Field label="Público-Alvo" value={data.publico_alvo} onChange={(v) => set("publico_alvo", v)} />
                  <Field label="Persona" value={data.persona} onChange={(v) => set("persona", v)} />
                  <Field label="Principais Objeções" value={data.objecoes} onChange={(v) => set("objecoes", v)} />
                  <Field label="Arquétipo" value={data.arquetipo} onChange={(v) => set("arquetipo", v)} />
                  <Field label="Referências" value={data.referencias} onChange={(v) => set("referencias", v)} />
                  <Field label="Concorrência" value={data.concorrencia} onChange={(v) => set("concorrencia", v)} />
                  <Field label="Canais de Divulgação" value={data.canais} onChange={(v) => set("canais", v)} />

                  <div className="space-y-2">
                    <Label>Materiais da Marca (links)</Label>
                    {data.materiais.map((m, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <Input placeholder="Nome do material" value={m.label}
                          onChange={(e) => set("materiais", data.materiais.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} />
                        <Input placeholder="https://..." value={m.url}
                          onChange={(e) => set("materiais", data.materiais.map((x, idx) => idx === i ? { ...x, url: e.target.value } : x))} />
                        {m.url && <a href={m.url} target="_blank" rel="noreferrer" className="self-center text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" /></a>}
                        <Button type="button" variant="ghost" size="icon" onClick={() => set("materiais", data.materiais.filter((_, idx) => idx !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => set("materiais", [...data.materiais, { label: "", url: "" }])}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar link
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="objetivos">
                <AccordionTrigger>Objetivos do Mês</AccordionTrigger>
                <AccordionContent className="pt-2">
                  <Field label="Metas e prioridades do mês" value={data.objetivos_mes} onChange={(v) => set("objetivos_mes", v)} rows={5} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="indicadores">
                <AccordionTrigger>Indicadores</AccordionTrigger>
                <AccordionContent className="space-y-2 pt-2">
                  {data.indicadores.map((ind, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_auto] gap-2 items-start">
                      <Input placeholder="Indicador" value={ind.nome}
                        onChange={(e) => set("indicadores", data.indicadores.map((x, idx) => idx === i ? { ...x, nome: e.target.value } : x))} />
                      <Input placeholder="Meta" value={ind.meta}
                        onChange={(e) => set("indicadores", data.indicadores.map((x, idx) => idx === i ? { ...x, meta: e.target.value } : x))} />
                      <Input placeholder="Atual" value={ind.atual}
                        onChange={(e) => set("indicadores", data.indicadores.map((x, idx) => idx === i ? { ...x, atual: e.target.value } : x))} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => set("indicadores", data.indicadores.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => set("indicadores", [...data.indicadores, { nome: "", meta: "", atual: "" }])}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar indicador
                  </Button>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          <div className="flex justify-end sticky bottom-4">
            <Button type="submit" disabled={save.isPending} className="shadow-lg">
              <Save className="h-4 w-4 mr-2" /> {save.isPending ? "Salvando..." : "Salvar cadastro"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={rows} />
    </div>
  );
}
