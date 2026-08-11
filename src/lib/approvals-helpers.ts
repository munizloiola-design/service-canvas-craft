const FALLBACK_BASE_URL = "https://workflow.digcomunicacao.com.br";

export function setPasswordRedirect(baseUrl?: string) {
  const base = (baseUrl ?? FALLBACK_BASE_URL).replace(/\/+$/, "");
  return `${base}/set-password`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function assertManager(ctx: any) {
  const { data } = await ctx.supabase.rpc("is_manager", { _uid: ctx.userId });
  if (!data) throw new Error("Sem permissão");
}
