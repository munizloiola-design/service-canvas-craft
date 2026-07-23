import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { describeSupabaseError } from "@/lib/supabase-error";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Handshake, Plus, Search, Tags, Pencil, Trash2, Mail, Phone, Briefcase } from "lucide-react";

export const Route = createFileRoute("/_app/parceiros")({
  component: ParceirosPage,
  head: () => ({
    meta: [
      { title: "Parceiros — Banco de Contatos" },
      { name: "description", content: "Cadastre e gerencie contatos parceiros da agência com categorias, busca e filtros." },
    ],
  }),
});

type Category = { id: string; name: string; created_at: string };
type Contact = {
  id: string;
  name: string;
  profession: string | null;
  phone: string | null;
  email: string | null;
  category_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const ALL = "__all__";

function ParceirosPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [professionFilter, setProfessionFilter] = useState<string>(ALL);

  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["contact_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_categories")
        .select("id, name, created_at")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const contactsQuery = useQuery({
    queryKey: ["partner_contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_contacts")
        .select("id, name, profession, phone, email, category_id, notes, created_at, updated_at")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });

  const categoriesById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categoriesQuery.data ?? []) m.set(c.id, c);
    return m;
  }, [categoriesQuery.data]);

  const professions = useMemo(() => {
    const s = new Set<string>();
    for (const c of contactsQuery.data ?? []) {
      if (c.profession && c.profession.trim()) s.add(c.profession.trim());
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [contactsQuery.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (contactsQuery.data ?? []).filter((c) => {
      if (term && !c.name.toLowerCase().includes(term)) return false;
      if (categoryFilter !== ALL && c.category_id !== categoryFilter) return false;
      if (professionFilter !== ALL && (c.profession ?? "") !== professionFilter) return false;
      return true;
    });
  }, [contactsQuery.data, search, categoryFilter, professionFilter]);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partner_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contato excluído");
      qc.invalidateQueries({ queryKey: ["partner_contacts"] });
    },
    onError: (e) => {
      console.error("[parceiros] delete contact", e);
      toast.error(describeSupabaseError(e));
    },
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2 text-gradient">
            <Handshake className="h-6 w-6" /> Parceiros
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Banco de contatos dos parceiros da agência.</p>
        </div>
        <div className="flex gap-2">
          {isManager && (
            <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
              <Tags className="h-4 w-4 mr-2" /> Gerenciar categorias
            </Button>
          )}
          <Button onClick={() => { setEditingContact(null); setContactOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo contato
          </Button>
        </div>
      </header>

      <Card className="p-4 grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Buscar por nome</Label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome do contato…" className="pl-9" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              {(categoriesQuery.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Profissão</Label>
          <Select value={professionFilter} onValueChange={setProfessionFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              {professions.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {contactsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Handshake className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium text-foreground">Nenhum contato encontrado</p>
          <p className="text-sm mt-1">Ajuste os filtros ou cadastre um novo parceiro.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const cat = c.category_id ? categoriesById.get(c.category_id) : null;
            return (
              <Card key={c.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{c.name}</h3>
                    {c.profession && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Briefcase className="h-3.5 w-3.5" /> {c.profession}
                      </p>
                    )}
                  </div>
                  {cat && <Badge variant="secondary" className="shrink-0">{cat.name}</Badge>}
                </div>

                <div className="space-y-1 text-sm">
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                      <Phone className="h-3.5 w-3.5" /> {c.phone}
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{c.email}</span>
                    </a>
                  )}
                </div>

                {c.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-3 border-t pt-2">{c.notes}</p>
                )}

                <div className="flex justify-end gap-1 mt-auto pt-2">
                  <Button size="sm" variant="ghost" onClick={() => { setEditingContact(c); setContactOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ContactDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        contact={editingContact}
        categories={categoriesQuery.data ?? []}
      />
      <CategoriesDialog
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        categories={categoriesQuery.data ?? []}
        canManage={isManager}
      />
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deleteMut.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ContactDialog({
  open, onOpenChange, contact, categories,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact: Contact | null;
  categories: Category[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "", profession: "", phone: "", email: "", category_id: "" as string, notes: "",
  });

  // reset when opening
  useMemo(() => {
    if (open) {
      setForm({
        name: contact?.name ?? "",
        profession: contact?.profession ?? "",
        phone: contact?.phone ?? "",
        email: contact?.email ?? "",
        category_id: contact?.category_id ?? "",
        notes: contact?.notes ?? "",
      });
    }
  }, [open, contact]);

  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        profession: form.profession.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        category_id: form.category_id || null,
        notes: form.notes.trim() || null,
      };
      if (!payload.name) throw new Error("Nome é obrigatório");
      if (contact) {
        const { error } = await supabase.from("partner_contacts").update(payload).eq("id", contact.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("partner_contacts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(contact ? "Contato atualizado" : "Contato cadastrado");
      qc.invalidateQueries({ queryKey: ["partner_contacts"] });
      onOpenChange(false);
    },
    onError: (e) => {
      console.error("[parceiros] save contact", e);
      toast.error(describeSupabaseError(e));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? "Editar contato" : "Novo contato"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Profissão</Label>
              <Input value={form.profession} onChange={(e) => setForm((f) => ({ ...f, profession: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.category_id || undefined} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{contact ? "Salvar" : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoriesDialog({
  open, onOpenChange, categories, canManage,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: Category[];
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["contact_categories"] });
    qc.invalidateQueries({ queryKey: ["partner_contacts"] });
  };

  const createMut = useMutation({
    mutationFn: async (name: string) => {
      if (!name.trim()) throw new Error("Nome obrigatório");
      const { error } = await supabase.from("contact_categories").insert({ name: name.trim() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Categoria criada"); setNewName(""); invalidate(); },
    onError: (e) => { console.error("[parceiros] create category", e); toast.error(describeSupabaseError(e)); },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("contact_categories").update({ name: name.trim() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Categoria atualizada"); setEditing(null); invalidate(); },
    onError: (e) => { console.error("[parceiros] update category", e); toast.error(describeSupabaseError(e)); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contact_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Categoria excluída"); invalidate(); },
    onError: (e) => { console.error("[parceiros] delete category", e); toast.error(describeSupabaseError(e)); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Categorias</DialogTitle>
        </DialogHeader>
        {canManage && (
          <div className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nova categoria" />
            <Button onClick={() => createMut.mutate(newName)} disabled={createMut.isPending}>Adicionar</Button>
          </div>
        )}
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma categoria cadastrada.</p>
          )}
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
              {editing?.id === c.id ? (
                <>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                    className="h-8"
                  />
                  <Button size="sm" onClick={() => updateMut.mutate(editing)}>OK</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>X</Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{c.name}</span>
                  {canManage && (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing({ id: c.id, name: c.name })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMut.mutate(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
