import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Users, Star } from "lucide-react";
import { toast } from "sonner";

type Team = { id: string; client_id: string; name: string; is_default: boolean };
type TeamMember = { id: string; team_id: string; user_id: string; role_hint: string | null };

export function TeamsPanel() {
  const qc = useQueryClient();
  const [clientId, setClientId] = useState<string>("");
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data as { id: string; name: string }[] ?? [],
  });

  const { data: members = [] } = useQuery({
    queryKey: ["profiles-team-picker"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name").order("full_name")).data as { id: string; full_name: string | null }[] ?? [],
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["client_teams", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("client_teams").select("*").eq("client_id", clientId).order("name");
      if (error) throw error;
      return (data ?? []) as Team[];
    },
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["client_team_members", clientId, teams.map((t) => t.id).join(",")],
    enabled: !!clientId && teams.length > 0,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("client_team_members")
        .select("*").in("team_id", teams.map((t) => t.id));
      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
  });

  const saveTeam = useMutation({
    mutationFn: async (payload: { name: string; is_default: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tbl = (supabase.from as any)("client_teams");
      if (payload.is_default) {
        await tbl.update({ is_default: false }).eq("client_id", clientId);
      }
      if (editingTeam) {
        const { error } = await tbl.update(payload).eq("id", editingTeam.id);
        if (error) throw error;
      } else {
        const { error } = await tbl.insert({ ...payload, client_id: clientId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Equipe salva");
      qc.invalidateQueries({ queryKey: ["client_teams", clientId] });
      setDlgOpen(false); setEditingTeam(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTeam = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)("client_teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Equipe removida");
      qc.invalidateQueries({ queryKey: ["client_teams", clientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMember = useMutation({
    mutationFn: async ({ teamId, userId, has }: { teamId: string; userId: string; has: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tbl = (supabase.from as any)("client_team_members");
      if (has) {
        const { error } = await tbl.delete().eq("team_id", teamId).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await tbl.insert({ team_id: teamId, user_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_team_members", clientId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const membersByTeam = teamMembers.reduce<Record<string, TeamMember[]>>((acc, m) => {
    (acc[m.team_id] ??= []).push(m); return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <Label className="mb-2 block">Cliente</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger><SelectValue placeholder="Selecione um cliente..." /></SelectTrigger>
          <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </Card>

      {!clientId && <p className="text-sm text-muted-foreground text-center py-12">Selecione um cliente para gerenciar suas equipes.</p>}

      {clientId && (
        <Card className="p-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{teams.length} equipe(s)</span>
            <Dialog open={dlgOpen} onOpenChange={(o) => { setDlgOpen(o); if (!o) setEditingTeam(null); }}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setEditingTeam(null)}><Plus className="h-4 w-4 mr-1" /> Nova equipe</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingTeam ? "Editar" : "Nova"} equipe</DialogTitle></DialogHeader>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    saveTeam.mutate({
                      name: String(fd.get("name") ?? ""),
                      is_default: fd.get("is_default") === "on",
                    });
                  }}
                >
                  <div className="space-y-1"><Label>Nome *</Label><Input name="name" required defaultValue={editingTeam?.name ?? ""} /></div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="is_default" name="is_default" defaultChecked={editingTeam?.is_default ?? false} />
                    <Label htmlFor="is_default" className="cursor-pointer">Equipe padrão deste cliente</Label>
                  </div>
                  <DialogFooter><Button type="submit" disabled={saveTeam.isPending}>{saveTeam.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {teams.length === 0 && <p className="text-sm text-center text-muted-foreground py-8">Nenhuma equipe cadastrada.</p>}

          <div className="space-y-3">
            {teams.map((t) => {
              const mine = membersByTeam[t.id] ?? [];
              const memberIds = new Set(mine.map((m) => m.user_id));
              return (
                <div key={t.id} className="border rounded-md p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm flex-1">{t.name}</span>
                    {t.is_default && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-primary/10 text-primary"><Star className="h-3 w-3" /> Padrão</span>}
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingTeam(t); setDlgOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
                      onClick={() => { if (confirm("Remover equipe?")) removeTeam.mutate(t.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pl-6">
                    {members.map((m) => {
                      const has = memberIds.has(m.id);
                      return (
                        <label key={m.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer hover:bg-muted/40 rounded px-2">
                          <Checkbox checked={has}
                            onCheckedChange={() => toggleMember.mutate({ teamId: t.id, userId: m.id, has })} />
                          <span className="truncate">{m.full_name || "(sem nome)"}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
