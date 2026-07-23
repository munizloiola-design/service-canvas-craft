import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Save, ExternalLink, Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { inviteClientUser, listClientAccess, removeClientAccess } from "@/lib/client-access.functions";
import { describeSupabaseError } from "@/lib/supabase-error";

export const Route = createFileRoute("/_app/clientes-area")({ component: ClientesAreaPage });

function ClientesAreaPage() {
  const { isManager } = useAuth();
  if (!isManager) {
    return <div className="p-8"><p className="text-muted-foreground">Apenas administradores e gerentes podem acessar.</p></div>;
  }
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Área do Cliente</h1>
        <p className="text-muted-foreground mt-1">Gerencie clientes e seu cadastro estratégico.</p>
      </header>
      <Tabs defaultValue="clientes">
        <TabsList>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="briefing">Cadastro estratégico</TabsTrigger>
          <TabsTrigger value="acesso">Acesso ao portal</TabsTrigger>
        </TabsList>
        <TabsContent value="clientes" className="mt-4"><ClientsCrud /></TabsContent>
        <TabsContent value="briefing" className="mt-4"><BriefingPanel /></TabsContent>
        <TabsContent value="acesso" className="mt-4"><ClientAccessPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Clientes CRUD ---------------- */
type Client = { id: string; name: string; contact_name: string | null; email: string | null; phone: string | null; notes: string | null; team_id: string | null };
type TeamOpt = { id: string; name: string };

function ClientsCrud() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [teamId, setTeamId] = useState<string>("");

  const { data: rows = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("clients").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from as any)("teams").select("id, name").order("name");
      return (data ?? []) as TeamOpt[];
    },
  });

  const teamName = (id: string | null) => (id ? teams.find((t) => t.id === id)?.name ?? null : null);

  const save = useMutation({
    mutationFn: async (payload: Omit<Client, "id">) => {
      try {
        if (editing?.id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from as any)("clients").update(payload).eq("id", editing.id);
          if (error) throw error;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from as any)("clients").insert(payload);
          if (error) throw error;
        }
      } catch (err) {
        console.error("[clients:save]", err, { payload, editingId: editing?.id });
        throw err;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Salvo"); setOpen(false); setEditing(null); },
    onError: (e: unknown) => toast.error(describeSupabaseError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await supabase.from("clients").delete().eq("id", id);
        if (error) throw error;
      } catch (err) {
        console.error("[clients:delete]", err, { id });
        throw err;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Removido"); },
    onError: (e: unknown) => toast.error(describeSupabaseError(e)),
  });

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-muted-foreground">{rows.length} cliente(s)</span>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditing(null);
            if (o) setTeamId(editing?.team_id ?? "");
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => { setEditing(null); setTeamId(""); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} cliente</DialogTitle></DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                save.mutate({
                  name: String(fd.get("name") ?? ""),
                  contact_name: (fd.get("contact_name") as string) || null,
                  email: (fd.get("email") as string) || null,
                  phone: (fd.get("phone") as string) || null,
                  notes: (fd.get("notes") as string) || null,
                  team_id: teamId || null,
                });
              }}
            >
              <div className="space-y-1"><Label>Nome / Empresa *</Label><Input name="name" required defaultValue={editing?.name ?? ""} /></div>
              <div className="space-y-1"><Label>Contato</Label><Input name="contact_name" defaultValue={editing?.contact_name ?? ""} /></div>
              <div className="space-y-1"><Label>E-mail</Label><Input name="email" type="email" defaultValue={editing?.email ?? ""} /></div>
              <div className="space-y-1"><Label>Telefone</Label><Input name="phone" defaultValue={editing?.phone ?? ""} /></div>
              <div className="space-y-1">
                <Label>Time responsável</Label>
                <Select value={teamId || "__none__"} onValueChange={(v) => setTeamId(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nenhum —</SelectItem>
                    {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Os membros deste time serão pré-preenchidos nas novas demandas deste cliente.</p>
              </div>
              <div className="space-y-1"><Label>Notas</Label><Textarea name="notes" rows={3} defaultValue={editing?.notes ?? ""} /></div>
              <DialogFooter><Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md divide-y">
        {rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum cliente</p>}
        {rows.map((r) => {
          const tn = teamName(r.team_id);
          return (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.contact_name}{r.contact_name && r.email ? " · " : ""}{r.email}
                  {tn && <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary">Time: {tn}</span>}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setTeamId(r.team_id ?? ""); setOpen(true); }}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
                onClick={() => { if (confirm("Remover?")) remove.mutate(r.id); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}


/* ---------------- Briefing estratégico ---------------- */
type Material = { label: string; url: string };
type Indicador = { nome: string; meta: string; atual: string };

type Briefing = {
  id?: string;
  client_id: string;
  historia: string; missao: string; visao: string; valores: string;
  analise_redes: string;
  publico_alvo: string; persona: string; objecoes: string; arquetipo: string;
  referencias: string; concorrencia: string; canais: string;
  swot_forcas: string; swot_fraquezas: string; swot_oportunidades: string; swot_ameacas: string;
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
  swot_forcas: "", swot_fraquezas: "", swot_oportunidades: "", swot_ameacas: "",
  objetivos_mes: "",
  materiais: [], indicadores: [],
});

function BriefingPanel() {
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

  const set = <K extends keyof Briefing>(k: K, v: Briefing[K]) => setData((d) => (d ? { ...d, [k]: v } : d));

  return (
    <div className="space-y-4">
      <Card className="p-4">
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

              <AccordionItem value="swot">
                <AccordionTrigger>Análise SWOT</AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
                      <Label className="text-emerald-700 dark:text-emerald-400">Forças (Strengths)</Label>
                      <Textarea rows={4} value={data.swot_forcas ?? ""} onChange={(e) => set("swot_forcas", e.target.value)} placeholder="Vantagens internas..." />
                    </div>
                    <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 space-y-1">
                      <Label className="text-rose-700 dark:text-rose-400">Fraquezas (Weaknesses)</Label>
                      <Textarea rows={4} value={data.swot_fraquezas ?? ""} onChange={(e) => set("swot_fraquezas", e.target.value)} placeholder="Pontos a melhorar..." />
                    </div>
                    <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3 space-y-1">
                      <Label className="text-sky-700 dark:text-sky-400">Oportunidades (Opportunities)</Label>
                      <Textarea rows={4} value={data.swot_oportunidades ?? ""} onChange={(e) => set("swot_oportunidades", e.target.value)} placeholder="Fatores externos favoráveis..." />
                    </div>
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
                      <Label className="text-amber-700 dark:text-amber-400">Ameaças (Threats)</Label>
                      <Textarea rows={4} value={data.swot_ameacas ?? ""} onChange={(e) => set("swot_ameacas", e.target.value)} placeholder="Riscos externos..." />
                    </div>
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

/* ---------------- Acesso ao portal ---------------- */
function ClientAccessPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [clientId, setClientId] = useState("");

  const invite = useServerFn(inviteClientUser);
  const remove = useServerFn(removeClientAccess);
  const listFn = useServerFn(listClientAccess);

  const { data: links = [], isLoading } = useQuery({ queryKey: ["client_access"], queryFn: () => listFn({}) });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-select"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const inviteMut = useMutation({
    mutationFn: () => invite({ data: { email, client_id: clientId } }),
    onSuccess: (r) => {
      toast.success(r.invited ? "Convite enviado por e-mail" : "Acesso vinculado");
      qc.invalidateQueries({ queryKey: ["client_access"] });
      setOpen(false); setEmail(""); setClientId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["client_access"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-muted-foreground">{links.length} vínculo(s)</span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><UserPlus className="h-4 w-4 mr-1" /> Conceder acesso</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Conceder acesso ao portal</DialogTitle></DialogHeader>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); inviteMut.mutate(); }}>
              <div className="space-y-1">
                <Label>E-mail do cliente *</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                <p className="text-xs text-muted-foreground">Se o usuário não existir, um convite será enviado por e-mail.</p>
              </div>
              <div className="space-y-1">
                <Label>Cliente vinculado *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <DialogFooter><Button type="submit" disabled={inviteMut.isPending || !email || !clientId}>{inviteMut.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md divide-y">
        {isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && links.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum cliente com acesso ao portal.</p>}
        {links.map((l) => (
          <div key={l.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{l.email || "(sem e-mail)"}</p>
              <p className="text-xs text-muted-foreground truncate">{l.client_name}</p>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
              onClick={() => { if (confirm("Remover acesso?")) removeMut.mutate(l.id); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

