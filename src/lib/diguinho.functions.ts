import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `Você é o Diguinho, assistente de IA de uma agência de marketing/produção audiovisual.
Você ajuda a equipe a:
- Sugerir ideias de conteúdo, roteiros, copies e legendas
- Discutir estratégias de marketing e tendências (com base no seu conhecimento, sem dados ao vivo)
- Brainstormar campanhas, ângulos e ganchos
- Analisar briefings e dar feedback construtivo

Seja direto, criativo e prático. Responda em português brasileiro. Use markdown quando útil.`;

export const listDiguinhoMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("diguinho_messages")
      .select("id, role, content, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return { messages: data ?? [] };
  });

export const clearDiguinhoHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("diguinho_messages").delete().eq("user_id", context.userId);
    return { ok: true };
  });

export const sendDiguinhoMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ content: z.string().min(1).max(8000) }).parse(i))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurado");

    const { supabase, userId } = context;

    // Save user message
    await supabase.from("diguinho_messages").insert({
      user_id: userId,
      role: "user",
      content: data.content,
    });

    // Load history (last 30)
    const { data: history } = await supabase
      .from("diguinho_messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    const ordered = (history ?? []).reverse();

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...ordered.map((m: any) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) return { ok: false, error: "Limite de uso atingido. Tente novamente em instantes." };
      if (res.status === 402) return { ok: false, error: "Créditos de IA esgotados. Adicione fundos em Settings → Workspace." };
      return { ok: false, error: `Erro IA (${res.status}): ${txt.slice(0, 200)}` };
    }

    const json: any = await res.json();
    const reply = json.choices?.[0]?.message?.content ?? "(sem resposta)";

    const { data: saved } = await supabase
      .from("diguinho_messages")
      .insert({ user_id: userId, role: "assistant", content: reply })
      .select("id, role, content, created_at")
      .single();

    return { ok: true, message: saved };
  });
