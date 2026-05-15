import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GRAPH = "https://graph.facebook.com/v21.0";

async function getCreds(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("integration_meta")
    .select("access_token, ad_account_id, page_id, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_CONNECTED");
  return data as { access_token: string; ad_account_id: string; page_id: string | null; display_name: string | null };
}

export const testMetaConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      access_token: z.string().min(20),
      ad_account_id: z.string().min(3),
    }).parse(i)
  )
  .handler(async ({ data }) => {
    const acc = data.ad_account_id.startsWith("act_") ? data.ad_account_id : `act_${data.ad_account_id}`;
    const url = `${GRAPH}/${acc}?fields=name,account_status,currency&access_token=${encodeURIComponent(data.access_token)}`;
    const res = await fetch(url);
    const json: any = await res.json();
    if (!res.ok) return { ok: false, error: json?.error?.message ?? "Falha ao validar" };
    return { ok: true, name: json.name as string, currency: json.currency as string };
  });

export const getMetaInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ date_preset: z.string().default("last_7d") }).parse(i)
  )
  .handler(async ({ data, context }) => {
    try {
      const creds = await getCreds(context.supabase, context.userId);
      const acc = creds.ad_account_id.startsWith("act_") ? creds.ad_account_id : `act_${creds.ad_account_id}`;
      const fields = "spend,impressions,clicks,ctr,cpc,reach,actions";
      const url = `${GRAPH}/${acc}/insights?fields=${fields}&date_preset=${data.date_preset}&level=account&access_token=${encodeURIComponent(creds.access_token)}`;
      const res = await fetch(url);
      const json: any = await res.json();
      if (!res.ok) return { connected: true, error: json?.error?.message ?? "Erro Meta", summary: null, campaigns: [] };

      const summary = json.data?.[0] ?? null;

      const camp = await fetch(
        `${GRAPH}/${acc}/campaigns?fields=name,status,objective,insights.date_preset(${data.date_preset}){spend,impressions,clicks,ctr}&limit=25&access_token=${encodeURIComponent(creds.access_token)}`
      );
      const campJson: any = await camp.json();

      return {
        connected: true,
        account_name: creds.display_name,
        summary,
        campaigns: (campJson.data ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          objective: c.objective,
          insights: c.insights?.data?.[0] ?? null,
        })),
        error: null,
      };
    } catch (e: any) {
      if (e.message === "NOT_CONNECTED") return { connected: false, summary: null, campaigns: [], error: null };
      return { connected: true, summary: null, campaigns: [], error: e.message };
    }
  });

export const getMetaConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("integration_meta")
      .select("ad_account_id, page_id, display_name, connected_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { connection: data ?? null };
  });

export const saveMetaConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      access_token: z.string().min(20),
      ad_account_id: z.string().min(3),
      page_id: z.string().optional().nullable(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const acc = data.ad_account_id.startsWith("act_") ? data.ad_account_id : `act_${data.ad_account_id}`;
    const test = await fetch(
      `${GRAPH}/${acc}?fields=name&access_token=${encodeURIComponent(data.access_token)}`
    );
    const tj: any = await test.json();
    if (!test.ok) return { ok: false, error: tj?.error?.message ?? "Token inválido" };

    const { error } = await context.supabase
      .from("integration_meta")
      .upsert({
        user_id: context.userId,
        access_token: data.access_token,
        ad_account_id: acc,
        page_id: data.page_id ?? null,
        display_name: tj.name ?? null,
      });
    if (error) return { ok: false, error: error.message };
    return { ok: true, name: tj.name as string };
  });

export const disconnectMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("integration_meta").delete().eq("user_id", context.userId);
    return { ok: true };
  });
