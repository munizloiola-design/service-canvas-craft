import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/squad")({ component: SquadPage });

type Team = { id: string; name: string };
type TeamMember = { team_id: string; user_id: string };

function SquadPage() {
  const { isManager } = useAuth();
  if (!isManager) {
    return <div className="p-8"><p className="text-muted-foreground">Apenas administradores e gerentes podem acessar.</p></div>;
  }
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Times</h1>
        <p className="text-muted-foreground mt-1">
          Monte times reutilizáveis. Ao vincular um time a um cliente, seus membros são preenchidos automaticamente nas demandas desse cliente.
        </p>
      </header>
      <TeamsCrud />
    </div>
  );
}

function TeamsCrud() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-team-picker"],
    queryFn: async () =>
      (await supabase.from("profiles").select("id, full_name").order("full_name")).data as
        | { id: string; full_name: string | null }[]
        | null ?? [],
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("teams").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as Team[];
    },
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ["team_members", teams.map((t) => t.id).join(",")],
    enabled: teams.length > 0,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("team_members")
        .select("team_id, user_id")
        .in("team_id", teams.map((t) => t.id));
      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
  });

  const membersByTeam = allMembers.reduce<Record<string, string[]>>((acc, m) => {
    (acc[m.team_id] ??= []).push(m.user_id);
    return acc;
  }, {});

  const save = useMutation({
    mutationFn: async (payload: { name: string; memberIds: string[] }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const teamsTbl = (supabase.from as any)("teams");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const membersTbl = (supabase.from as any)("team_members");
      let teamId: string;
      if (editing) {
        const { error } = await teamsTbl.update({ name: payload.name }).eq("id", editing.id);
        if (error) throw error;
        teamId = editing.id;
      } else {
        const { data, error } = await teamsTbl.insert({ name: payload.name }).select("id").single();
        if (error) throw error;
        teamId = data.id;
      }
      const existing = new Set(membersByTeam[teamId] ?? []);
      const next = new Set(payload.memberIds);
      const toAdd = [...next].filter((id) => !existing.has(id));
      const toRemove = [...existing].filter((id) => !next.has(id));
      if (toAdd.length) {
        const { error } = await membersTbl.insert(toAdd.map((user_id) => ({ team_id: teamId, user_id })));
        if (error) throw error;
      }
      if (toRemove.length) {
        const { error } = await membersTbl.delete().eq("team_id", teamId).in("user_id", toRemove);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Time salvo");
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["team_members"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Time removido");
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["team_members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{teams.length} time(s)</span>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-1" /> Novo time</Button>
          </DialogTrigger>
          <TeamDialog
            key={editing?.id ?? "new"}
            editing={editing}
            profiles={profiles}
            initialMembers={editing ? membersByTeam[editing.id] ?? [] : []}
            onSubmit={(payload) => save.mutate(payload)}
            saving={save.isPending}
          />
        </Dialog>
      </div>

      {teams.length === 0 && <p className="text-sm text-center text-muted-foreground py-8">Nenhum time cadastrado.</p>}

      <div className="space-y-2">
        {teams.map((t) => {
          const memberIds = membersByTeam[t.id] ?? [];
          const names = memberIds
            .map((id) => profiles.find((p) => p.id === id)?.full_name || "(sem nome)")
            .join(", ");
          return (
            <div key={t.id} className="border rounded-md p-3 flex items-start gap-3">
              <Users className="h-4 w-4 text-muted-foreground mt-1" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {memberIds.length === 0 ? "Sem membros" : `${memberIds.length} membro(s): ${names}`}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(t); setOpen(true); }}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => { if (confirm("Remover time?")) remove.mutate(t.id); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TeamDialog({
  editing,
  profiles,
  initialMembers,
  onSubmit,
  saving,
}: {
  editing: Team | null;
  profiles: { id: string; full_name: string | null }[];
  initialMembers: string[];
  onSubmit: (payload: { name: string; memberIds: string[] }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(initialMembers));

  const toggle = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} time</DialogTitle></DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) { toast.error("Nome obrigatório"); return; }
          onSubmit({ name: name.trim(), memberIds: [...selected] });
        }}
      >
        <div className="space-y-1">
          <Label>Nome *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>Membros</Label>
          <div className="max-h-72 overflow-y-auto border rounded-md p-2 space-y-1">
            {profiles.length === 0 && <p className="text-xs text-muted-foreground p-2">Nenhum perfil disponível.</p>}
            {profiles.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted/40 cursor-pointer">
                <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                <span className="truncate">{p.full_name || "(sem nome)"}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{selected.size} selecionado(s)</p>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
