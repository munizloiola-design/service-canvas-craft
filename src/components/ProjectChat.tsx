import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Comment = {
  id: string;
  project_id: string;
  author_id: string;
  content: string;
  created_at: string;
};

type Author = { id: string; full_name: string | null; avatar_url: string | null };

export function ProjectChat({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { user, isManager } = useAuth();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const { data: comments = [] } = useQuery({
    queryKey: ["project_comments", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_comments")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Comment[];
    },
  });

  const authorIds = useMemo(
    () => Array.from(new Set(comments.map((c) => c.author_id))),
    [comments]
  );

  const { data: authors = [] } = useQuery({
    queryKey: ["chat_authors", authorIds.join(",")],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", authorIds);
      return (data ?? []) as Author[];
    },
  });
  const authorMap = useMemo(() => new Map(authors.map((a) => [a.id, a])), [authors]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`project_comments:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_comments", filter: `project_id=eq.${projectId}` },
        () => qc.invalidateQueries({ queryKey: ["project_comments", projectId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, qc]);

  // Auto scroll
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [comments.length]);

  const send = useMutation({
    mutationFn: async () => {
      const content = text.trim();
      if (!content) throw new Error("Mensagem vazia");
      if (content.length > 4000) throw new Error("Máximo 4000 caracteres");
      if (!user) throw new Error("Faça login");
      const { error } = await supabase
        .from("project_comments")
        .insert({ project_id: projectId, author_id: user.id, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["project_comments", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project_comments", projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border rounded-md bg-muted/20">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40">
        <MessageCircle className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide">Bate-papo da demanda</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{comments.length} mensagem(ns)</span>
      </div>

      <div ref={listRef} className="max-h-72 overflow-y-auto px-3 py-3 space-y-3">
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            Nenhuma mensagem ainda. Use o bate-papo para anotações e dúvidas.
          </p>
        )}
        {comments.map((c) => {
          const a = authorMap.get(c.author_id);
          const mine = c.author_id === user?.id;
          const initials = (a?.full_name || "?").slice(0, 2).toUpperCase();
          const canDelete = mine || isManager;
          return (
            <div key={c.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <Avatar className="h-7 w-7 shrink-0">
                {a?.avatar_url && <AvatarImage src={a.avatar_url} alt={a.full_name ?? ""} />}
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className={`flex-1 min-w-0 ${mine ? "items-end" : ""}`}>
                <div className={`flex items-center gap-2 text-[10px] text-muted-foreground mb-0.5 ${mine ? "justify-end" : ""}`}>
                  <span className="font-medium text-foreground">{a?.full_name ?? "Usuário"}</span>
                  <span>{new Date(c.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  {canDelete && (
                    <button
                      onClick={() => { if (confirm("Apagar mensagem?")) remove.mutate(c.id); }}
                      className="opacity-50 hover:opacity-100 hover:text-destructive"
                      aria-label="Apagar"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className={`inline-block rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words max-w-full ${mine ? "bg-primary text-primary-foreground" : "bg-background border"}`}>
                  {c.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t p-2 bg-background">
        <div className="flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send.mutate();
              }
            }}
            placeholder="Escreva uma anotação ou dúvida... (Ctrl+Enter envia)"
            rows={2}
            maxLength={4000}
            className="resize-none text-sm"
          />
          <Button
            size="sm"
            onClick={() => send.mutate()}
            disabled={send.isPending || !text.trim()}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
