import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Trash2, Save, ExternalLink, Pencil, UserPlus,
  Users, KeyRound, FileText, FolderKanban, Sparkles, Search, MessageCircle,
  Settings2, ArrowUp, ArrowDown, Trophy, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { inviteClientUser, listClientAccess, removeClientAccess } from "@/lib/client-access.functions";
import { describeSupabaseError } from "@/lib/supabase-error";

export const Route = createFileRoute("/_app/clientes")({ component: ClientesPage });

type ClientStatus = "ativo" | "inativo" | "prospeccao";

function ClientesPage() {
  const { isManager } = useAuth();
  const [selectedClient, setSelectedClient] = useState<string>("");

  if (!isManager) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Apenas administradores e gerentes podem acessar.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gradient">Clientes</h1>
        <p className="text-muted-foreground mt-1">
          Dossiê central: diretório, acessos ao portal, briefing estratégico, projetos e prospecção.
        </p>
      </header>

      <Tabs defaultValue="diretorio" className="space-y-4">
        <TabsList className="bg-card/70 backdrop-blur border">
          <TabsTrigger value="diretorio" className="gap-1.5"><Users className="h-4 w-4" /> Diretório</TabsTrigger>
          <TabsTrigger value="acessos" className="gap-1.5"><KeyRound className="h-4 w-4" /> Acessos do Portal</TabsTrigger>
          <TabsTrigger value="briefing" className="gap-1.5"><FileText className="h-4 w-4" /> Briefing & Estratégia</TabsTrigger>
          <TabsTrigger value="projetos" className="gap-1.5"><FolderKanban className="h-4 w-4" /> Projetos Ativos</TabsTrigger>
        </TabsList>

        <TabsContent value="diretorio"><DirectoryTab onOpenBriefing={setSelectedClient} /></TabsContent>
        <TabsContent value="acessos"><AccessTab /></TabsContent>
        <TabsContent value="briefing"><BriefingTab clientId={selectedClient} setClientId={setSelectedClient} /></TabsContent>
        <TabsContent value="projetos"><ProjectsTab clientId={selectedClient} setClientId={setSelectedClient} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================================================
   ABA 1 — Diretório
============================================================ */
type Client = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: ClientStatus;
  prospect_stage: string | null;
  prospect_value: number | null;
  prospect_next_action: string | null;
  prospect_next_action_at: string | null;
};

const STATUS_META: Record<ClientStatus, { label: string; className: string }> = {
  ativo:      { label: "Ativo",      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  inativo:    { label: "Inativo",    className: "bg-muted text-muted-foreground border-border" },
  prospeccao: { label: "Prospecção", className: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30" },
};

function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });
}

function useDefaultClientTeams() {
  return useQuery({
    queryKey: ["client_teams", "defaults"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_teams")
        .select("client_id, name")
        .eq("is_default", true);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of (data ?? []) as Array<{ client_id: string; name: string }>) {
        map.set(row.client_id, row.name);
      }
      return map;
    },
  });
}

function DirectoryTab({ onOpenBriefing }: { onOpenBriefing: (id: string) => void }) {
  const qc = useQueryClient();
  const { data: rows = [] } = useClients();
  const { data: defaultTeams } = useDefaultClientTeams();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [status, setStatus] = useState<ClientStatus>("ativo");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "all">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.name, r.contact_name, r.email, r.phone].some((f) => (f ?? "").toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter]);

  const save = useMutation({
    mutationFn: async (payload: Partial<Client>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tbl = (supabase.from as any)("clients");
      if (editing?.id) {
        const { error } = await tbl.update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await tbl.insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Salvo");
      setOpen(false); setEditing(null);
    },
    onError: (e: unknown) => toast.error(describeSupabaseError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Removido"); },
    onError: (e: unknown) => toast.error(describeSupabaseError(e)),
  });

  const openNew = () => { setEditing(null); setStatus("ativo"); setOpen(true); };
  const openEdit = (c: Client) => { setEditing(c); setStatus(c.status); setOpen(true); };

  return (
    <Card className="p-4 md:p-6 bg-card/95 backdrop-blur">
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, contato, e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="prospeccao">Prospecção</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo cliente</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Time padrão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => {
              const tn = defaultTeams?.get(r.id) ?? null;
              const meta = STATUS_META[r.status] ?? STATUS_META.inativo;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.contact_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.email || "—"}</TableCell>
                  <TableCell>{tn ? <Badge variant="secondary">{tn}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={meta.className}>
                      {meta.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" title="Abrir briefing" onClick={() => onOpenBriefing(r.id)}>
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => { if (confirm(`Remover ${r.name}?`)) remove.mutate(r.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg">
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
                status,
              });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><Label>Nome / Empresa *</Label><Input name="name" required defaultValue={editing?.name ?? ""} /></div>
              <div className="space-y-1"><Label>Contato</Label><Input name="contact_name" defaultValue={editing?.contact_name ?? ""} /></div>
              <div className="space-y-1"><Label>Telefone</Label><Input name="phone" defaultValue={editing?.phone ?? ""} /></div>
              <div className="col-span-2 space-y-1"><Label>E-mail</Label><Input name="email" type="email" defaultValue={editing?.email ?? ""} /></div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as ClientStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="prospeccao">Prospecção</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1"><Label>Notas</Label><Textarea name="notes" rows={3} defaultValue={editing?.notes ?? ""} /></div>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure times por cliente na aba de acessos/briefing quando necessário.
            </p>
            <DialogFooter><Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ============================================================
   ABA 2 — Acessos do Portal
============================================================ */
function AccessTab() {
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
    mutationFn: () => invite({ data: { email, client_id: clientId, redirect_to: `${window.location.origin}/set-password` } }),
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
    <Card className="p-4 md:p-6 bg-card/95 backdrop-blur">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold">Acessos do portal</h2>
          <p className="text-sm text-muted-foreground">{links.length} vínculo(s) — clientes que fazem login no portal de aprovação.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><UserPlus className="h-4 w-4 mr-1" /> Conceder acesso</Button></DialogTrigger>
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
              <DialogFooter>
                <Button type="submit" disabled={inviteMut.isPending || !email || !clientId}>
                  {inviteMut.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg divide-y">
        {isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && links.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum cliente com acesso ao portal.</p>
        )}
        {links.map((l) => (
          <div key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{l.email || "(sem e-mail)"}</p>
              <p className="text-xs text-muted-foreground truncate">{l.client_name}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => { if (confirm("Remover acesso?")) removeMut.mutate(l.id); }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ============================================================
   ABA 3 — Briefing & Estratégia
============================================================ */
type Material = { label: string; url: string };
type Indicador = { nome: string; meta: string; atual: string };

type Briefing = {
  id?: string;
  client_id: string;
  historia: string; missao: string; visao: string; valores: string;
  analise_redes: string;
  publico_alvo: string; persona: string; objecoes: string; arquetipo: string;
  referencias: string; concorrencia: string; canais: string;
  tom_de_voz: string;
  swot_forcas: string; swot_fraquezas: string; swot_oportunidades: string; swot_ameacas: string;
  objetivos_mes: string;
  materiais: Material[];
  indicadores: Indicador[];
};

const emptyBriefing = (client_id: string): Briefing => ({
  client_id,
  historia: "", missao: "", visao: "", valores: "",
  analise_redes: "",
  publico_alvo: "", persona: "", objecoes: "", arquetipo: "",
  referencias: "", concorrencia: "", canais: "",
  tom_de_voz: "",
  swot_forcas: "", swot_fraquezas: "", swot_oportunidades: "", swot_ameacas: "",
  objetivos_mes: "",
  materiais: [], indicadores: [],
});

function BriefingTab({ clientId, setClientId }: { clientId: string; setClientId: (id: string) => void }) {
  const qc = useQueryClient();
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
    setData(briefing
      ? { ...emptyBriefing(clientId), ...briefing, materiais: briefing.materiais ?? [], indicadores: briefing.indicadores ?? [] }
      : emptyBriefing(clientId));
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
    onError: (e: unknown) => toast.error(describeSupabaseError(e)),
  });

  const set = <K extends keyof Briefing>(k: K, v: Briefing[K]) =>
    setData((d) => (d ? { ...d, [k]: v } : d));

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card/95 backdrop-blur">
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
          <Card className="p-4 md:p-6 bg-card/95 backdrop-blur">
            <Accordion type="multiple" defaultValue={["marca"]} className="w-full">
              <AccordionItem value="empresa">
                <AccordionTrigger>Empresa</AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <Field label="História da Empresa" value={data.historia} onChange={(v) => set("historia", v)} />
                  <div className="grid md:grid-cols-3 gap-3">
                    <Field label="Missão" value={data.missao} onChange={(v) => set("missao", v)} />
                    <Field label="Visão" value={data.visao} onChange={(v) => set("visao", v)} />
                    <Field label="Valores" value={data.valores} onChange={(v) => set("valores", v)} />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="marca">
                <AccordionTrigger>Estudo da Marca</AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="grid md:grid-cols-2 gap-3">
                    <Field label="Público-Alvo" value={data.publico_alvo} onChange={(v) => set("publico_alvo", v)} />
                    <Field label="Persona" value={data.persona} onChange={(v) => set("persona", v)} />
                    <Field label="Tom de voz" value={data.tom_de_voz} onChange={(v) => set("tom_de_voz", v)} />
                    <Field label="Arquétipo" value={data.arquetipo} onChange={(v) => set("arquetipo", v)} />
                    <Field label="Principais Objeções" value={data.objecoes} onChange={(v) => set("objecoes", v)} />
                    <Field label="Referências visuais" value={data.referencias} onChange={(v) => set("referencias", v)} />
                    <Field label="Concorrência" value={data.concorrencia} onChange={(v) => set("concorrencia", v)} />
                    <Field label="Canais de Divulgação" value={data.canais} onChange={(v) => set("canais", v)} />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="links">
                <AccordionTrigger>Links importantes (Drive, logotipo, materiais)</AccordionTrigger>
                <AccordionContent className="space-y-2 pt-2">
                  {data.materiais.map((m, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <Input placeholder="Nome do material" value={m.label}
                        onChange={(e) => set("materiais", data.materiais.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} />
                      <Input placeholder="https://..." value={m.url}
                        onChange={(e) => set("materiais", data.materiais.map((x, idx) => idx === i ? { ...x, url: e.target.value } : x))} />
                      {m.url && (
                        <a href={m.url} target="_blank" rel="noreferrer" className="self-center text-muted-foreground hover:text-foreground">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <Button type="button" variant="ghost" size="icon"
                        onClick={() => set("materiais", data.materiais.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => set("materiais", [...data.materiais, { label: "", url: "" }])}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar link
                  </Button>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="redes">
                <AccordionTrigger>Análise das Redes Sociais</AccordionTrigger>
                <AccordionContent className="pt-2">
                  <Field label="Diagnóstico atual das redes" value={data.analise_redes} onChange={(v) => set("analise_redes", v)} rows={5} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="swot">
                <AccordionTrigger>Análise SWOT</AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
                      <Label className="text-emerald-700 dark:text-emerald-400">Forças</Label>
                      <Textarea rows={4} value={data.swot_forcas ?? ""} onChange={(e) => set("swot_forcas", e.target.value)} placeholder="Vantagens internas..." />
                    </div>
                    <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 space-y-1">
                      <Label className="text-rose-700 dark:text-rose-400">Fraquezas</Label>
                      <Textarea rows={4} value={data.swot_fraquezas ?? ""} onChange={(e) => set("swot_fraquezas", e.target.value)} placeholder="Pontos a melhorar..." />
                    </div>
                    <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3 space-y-1">
                      <Label className="text-sky-700 dark:text-sky-400">Oportunidades</Label>
                      <Textarea rows={4} value={data.swot_oportunidades ?? ""} onChange={(e) => set("swot_oportunidades", e.target.value)} placeholder="Fatores externos favoráveis..." />
                    </div>
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
                      <Label className="text-amber-700 dark:text-amber-400">Ameaças</Label>
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
                      <Button type="button" variant="ghost" size="icon"
                        onClick={() => set("indicadores", data.indicadores.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => set("indicadores", [...data.indicadores, { nome: "", meta: "", atual: "" }])}>
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

/* ============================================================
   ABA 4 — Projetos Ativos (somente leitura)
============================================================ */
type ProjectRow = {
  id: string;
  title: string;
  due_date: string | null;
  assigned_to: string | null;
  status_id: string | null;
  status_name?: string | null;
  status_color?: string | null;
};

function ProjectsTab({ clientId, setClientId }: { clientId: string; setClientId: (id: string) => void }) {
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["client-projects", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("projects")
        .select("id, title, due_date, assigned_to, status_id, workflow_statuses(name, color)")
        .eq("client_id", clientId)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).map((p) => ({
        id: p.id, title: p.title, due_date: p.due_date, assigned_to: p.assigned_to, status_id: p.status_id,
        status_name: p.workflow_statuses?.name ?? null,
        status_color: p.workflow_statuses?.color ?? null,
      })) as ProjectRow[];
    },
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card/95 backdrop-blur">
        <Label className="mb-2 block">Cliente</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger><SelectValue placeholder="Selecione um cliente..." /></SelectTrigger>
          <SelectContent>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      {!clientId && <p className="text-sm text-muted-foreground text-center py-12">Selecione um cliente para ver os projetos.</p>}
      {clientId && isFetching && <p className="text-sm text-muted-foreground text-center py-12">Carregando...</p>}

      {clientId && !isFetching && (
        <Card className="p-4 md:p-6 bg-card/95 backdrop-blur">
          {rows.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <FolderKanban className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum projeto para este cliente.</p>
              <Button asChild size="sm" variant="outline">
                <Link to="/projects">Ir para projetos</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell>
                      {r.status_name ? (
                        <Badge
                          variant="outline"
                          style={r.status_color ? { borderColor: r.status_color, color: r.status_color } : undefined}
                        >
                          {r.status_name}
                        </Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.due_date ? new Date(r.due_date).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/projects/$projectId" params={{ projectId: r.id }}>Abrir</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}

/* ============================================================
   ABA 5 — CRM Prospecção
============================================================ */
type CrmStage = {
  id: string;
  name: string;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
  color: string | null;
};

function useCrmStages() {
  return useQuery({
    queryKey: ["crm_stages"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("crm_stages")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as CrmStage[];
    },
  });
}

export function CrmTab() {
  const qc = useQueryClient();
  const { data: rows = [] } = useClients();
  const { data: stages = [] } = useCrmStages();
  const [managerOpen, setManagerOpen] = useState(false);
  const prospects = useMemo(() => rows.filter((r) => r.status === "prospeccao"), [rows]);

  const update = useMutation({
    mutationFn: async (payload: Partial<Client> & { id: string }) => {
      const { id, ...rest } = payload;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)("clients").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Atualizado"); },
    onError: (e: unknown) => toast.error(describeSupabaseError(e)),
  });

  const firstStageName = stages[0]?.name ?? "Novo lead";

  const byStage = useMemo(() => {
    const map: Record<string, Client[]> = {};
    stages.forEach((s) => (map[s.name] = []));
    const unset: Client[] = [];
    for (const p of prospects) {
      const stage = (p.prospect_stage ?? "").trim();
      if (stage && map[stage]) map[stage].push(p);
      else unset.push(p);
    }
    if (unset.length && map[firstStageName]) map[firstStageName].push(...unset);
    return map;
  }, [prospects, stages, firstStageName]);

  const total = prospects.length;
  const totalValor = prospects.reduce((s, p) => s + (Number(p.prospect_value) || 0), 0);

  const handleDrop = (clientId: string, stage: CrmStage) => {
    const current = prospects.find((p) => p.id === clientId);
    if (!current || current.prospect_stage === stage.name) return;
    if (stage.is_won) {
      update.mutate({ id: clientId, status: "ativo", prospect_stage: stage.name });
    } else if (stage.is_lost) {
      update.mutate({ id: clientId, status: "inativo", prospect_stage: stage.name });
    } else {
      update.mutate({ id: clientId, prospect_stage: stage.name });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
          <Card className="p-4 bg-card/95 backdrop-blur">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Prospects ativos</p>
            <p className="text-3xl font-semibold mt-1">{total}</p>
          </Card>
          <Card className="p-4 bg-card/95 backdrop-blur">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Pipeline (valor estimado)</p>
            <p className="text-3xl font-semibold mt-1">
              {totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </Card>
          <Card className="p-4 bg-card/95 backdrop-blur">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Ações pendentes</p>
            <p className="text-3xl font-semibold mt-1">
              {prospects.filter((p) => p.prospect_next_action).length}
            </p>
          </Card>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setManagerOpen(true)}>
          <Settings2 className="h-4 w-4 mr-1.5" /> Gerenciar estágios
        </Button>
      </div>

      {stages.length === 0 && (
        <Card className="p-10 text-center bg-card/95 backdrop-blur">
          <p className="text-sm text-muted-foreground">
            Nenhum estágio cadastrado. Clique em "Gerenciar estágios" para começar.
          </p>
        </Card>
      )}

      {stages.length > 0 && total === 0 && (
        <Card className="p-10 text-center bg-card/95 backdrop-blur">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhum cliente em prospecção. Cadastre um cliente com status <strong>Prospecção</strong> no Diretório para começar.
          </p>
        </Card>
      )}

      {stages.length > 0 && total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              items={byStage[stage.name] ?? []}
              onDropClient={(clientId) => handleDrop(clientId, stage)}
              renderCard={(p) => (
                <ProspectCard
                  key={p.id}
                  client={p}
                  stages={stages}
                  onChange={(patch) => update.mutate({ id: p.id, ...patch })}
                  onWin={() => {
                    const won = stages.find((s) => s.is_won);
                    update.mutate({ id: p.id, status: "ativo", prospect_stage: won?.name ?? p.prospect_stage ?? null });
                  }}
                  onLose={() => {
                    const lost = stages.find((s) => s.is_lost);
                    update.mutate({ id: p.id, status: "inativo", prospect_stage: lost?.name ?? p.prospect_stage ?? null });
                  }}
                />
              )}
            />
          ))}
        </div>
      )}

      <StagesManagerDialog open={managerOpen} onOpenChange={setManagerOpen} stages={stages} prospects={prospects} />
    </div>
  );
}


function StageColumn({
  stage, items, onDropClient, renderCard,
}: {
  stage: Stage;
  items: Client[];
  onDropClient: (clientId: string) => void;
  renderCard: (c: Client) => React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  return (
    <Card
      className={`p-4 bg-card/95 backdrop-blur transition-colors ${over ? "ring-2 ring-primary/60" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDropClient(id);
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{stage}</h3>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      <div className="space-y-2 min-h-[40px]">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Arraste um card para cá</p>
        )}
        {items.map((p) => renderCard(p))}
      </div>
    </Card>
  );
}

function buildWhatsAppUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withDdi = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withDdi}`;
}

function ProspectCard({
  client, onChange, onWin, onLose,
}: {
  client: Client;
  onChange: (patch: Partial<Client>) => void;
  onWin: () => void;
  onLose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", client.id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={`rounded-md border bg-background p-3 space-y-1 cursor-grab active:cursor-grabbing transition-opacity ${dragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{client.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {client.contact_name || client.email || "—"}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {client.phone && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
              title="Enviar WhatsApp"
              onClick={(e) => {
                e.stopPropagation();
                window.open(buildWhatsAppUrl(client.phone!), "_blank", "noopener,noreferrer");
              }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {client.prospect_value != null && (
        <p className="text-xs">
          <span className="text-muted-foreground">Valor: </span>
          <strong>{Number(client.prospect_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
        </p>
      )}
      {client.prospect_next_action && (
        <p className="text-xs">
          <span className="text-muted-foreground">Próxima ação: </span>
          {client.prospect_next_action}
          {client.prospect_next_action_at && (
            <span className="text-muted-foreground"> · {new Date(client.prospect_next_action_at).toLocaleDateString("pt-BR")}</span>
          )}
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{client.name}</DialogTitle></DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              onChange({
                prospect_stage: (fd.get("stage") as Stage) || null,
                prospect_value: fd.get("value") ? Number(fd.get("value")) : null,
                prospect_next_action: (fd.get("action") as string) || null,
                prospect_next_action_at: (fd.get("action_at") as string) || null,
              });
              setOpen(false);
            }}
          >
            <div className="space-y-1">
              <Label>Estágio</Label>
              <Select name="stage" defaultValue={client.prospect_stage ?? "Novo lead"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Valor estimado (R$)</Label>
                <Input name="value" type="number" step="0.01" defaultValue={client.prospect_value ?? ""} />
              </div>
              <div className="space-y-1">
                <Label>Data da próxima ação</Label>
                <Input name="action_at" type="date" defaultValue={client.prospect_next_action_at ?? ""} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Próxima ação</Label>
              <Input name="action" defaultValue={client.prospect_next_action ?? ""} placeholder="Ex.: enviar proposta..." />
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => { onWin(); setOpen(false); }}>Marcar como Ganho</Button>
                <Button type="button" variant="outline" className="text-destructive" onClick={() => { onLose(); setOpen(false); }}>Perdido</Button>
              </div>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
