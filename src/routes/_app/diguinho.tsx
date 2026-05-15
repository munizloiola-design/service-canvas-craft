import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listDiguinhoMessages, sendDiguinhoMessage, clearDiguinhoHistory } from "@/lib/diguinho.functions";

export const Route = createFileRoute("/_app/diguinho")({ component: DiguinhoPage });

const SUGESTOES = [
  "Me dê 5 ideias de Reels para uma marca de café especial",
  "Escreva 3 legendas para um post de lançamento de curso online",
  "Sugira ganchos virais para vídeo de imobiliária de alto padrão",
  "Roteiro de 30s pra um anúncio de restaurante novo",
];

function DiguinhoPage() {
  const list = useServerFn(listDiguinhoMessages);
  const send = useServerFn(sendDiguinhoMessage);
  const clear = useServerFn(clearDiguinhoHistory);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["diguinho"], queryFn: () => list() });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMut = useMutation({
    mutationFn: (content: string) => send({ data: { content } }),
    onMutate: () => setInput(""),
    onSuccess: (r: any) => {
      if (!r.ok) toast.error(r.error);
      qc.invalidateQueries({ queryKey: ["diguinho"] });
    },
  });

  const clearMut = useMutation({
    mutationFn: () => clear({}),
    onSuccess: () => { toast.success("Histórico limpo"); qc.invalidateQueries({ queryKey: ["diguinho"] }); },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.messages?.length, sendMut.isPending]);

  function handleSend() {
    const text = input.trim();
    if (!text || sendMut.isPending) return;
    sendMut.mutate(text);
  }

  const messages = data?.messages ?? [];

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold">Diguinho</h1>
            <p className="text-xs text-muted-foreground">Seu assistente criativo de marketing</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => clearMut.mutate()}>
            <Trash2 className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto px-8 py-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center">Carregando…</p>
        ) : messages.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center space-y-6 mt-12">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center">
              <Sparkles className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Oi, sou o Diguinho 👋</h2>
              <p className="text-muted-foreground mt-1">Posso ajudar com ideias, roteiros, copies e estratégias.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-xl mx-auto">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMut.mutate(s)}
                  className="text-left text-sm p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((m: any) => <MsgBubble key={m.id} role={m.role} content={m.content} />)}
            {sendMut.isPending && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8"><AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-xs"><Sparkles className="h-4 w-4" /></AvatarFallback></Avatar>
                <Card className="px-4 py-3 text-sm text-muted-foreground"><span className="inline-flex gap-1"><Dot /><Dot delay={150} /><Dot delay={300} /></span></Card>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t bg-background px-8 py-4">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <Textarea
            placeholder="Pergunte ao Diguinho…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            rows={1}
            className="min-h-[44px] resize-none"
          />
          <Button onClick={handleSend} disabled={!input.trim() || sendMut.isPending} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MsgBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"><Sparkles className="h-4 w-4" /></AvatarFallback>
        </Avatar>
      )}
      <Card className={`px-4 py-3 max-w-[80%] text-sm whitespace-pre-wrap ${isUser ? "bg-primary text-primary-foreground" : ""}`}>
        {content}
      </Card>
    </div>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: `${delay}ms` }} />;
}
