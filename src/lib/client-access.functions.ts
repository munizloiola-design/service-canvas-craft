import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertManager(supabase: NonNullable<Awaited<ReturnType<typeof import("@/integrations/supabase/auth-middleware").requireSupabaseAuth>>["context"]>["supabase"], userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r) => r.role === "admin" || r.role === "gerente");
  if (!ok) throw new Error("Forbidden");
}

const InviteSchema = z.object({
  email: z.string().email().max(255),
  client_id: z.string().uuid(),
});

export const inviteClientUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const email = data.email.toLowerCase().trim();

    // Try to find existing user
    let userId: string | null = null;
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw new Error(listErr.message);
    const existing = list?.users.find((u) => u.email?.toLowerCase() === email);
    if (existing) {
      userId = existing.id;
    } else {
      const redirectTo = `${process.env.SUPABASE_URL ? "" : ""}`; // placeholder; supabase uses Site URL
      const { data: inv, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, redirectTo ? { redirectTo } : undefined);
      if (invErr || !inv?.user) throw new Error(invErr?.message ?? "Falha ao convidar usuário");
      userId = inv.user.id;
    }

    // Ensure role 'cliente'
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "cliente")
      .maybeSingle();
    if (!roleRow) {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "cliente" });
      if (roleErr) throw new Error(roleErr.message);
    }

    // Link to client (upsert)
    const { data: linkRow } = await supabaseAdmin
      .from("client_users")
      .select("id")
      .eq("user_id", userId)
      .eq("client_id", data.client_id)
      .maybeSingle();
    if (!linkRow) {
      const { error: linkErr } = await supabaseAdmin
        .from("client_users")
        .insert({ user_id: userId, client_id: data.client_id });
      if (linkErr) throw new Error(linkErr.message);
    }

    return { ok: true, user_id: userId, invited: !existing };
  });

const RemoveSchema = z.object({ id: z.string().uuid() });

export const removeClientAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RemoveSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const { error } = await supabaseAdmin.from("client_users").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listClientAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context.supabase, context.userId);
    const { data: links, error } = await supabaseAdmin
      .from("client_users")
      .select("id, user_id, client_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((links ?? []).map((l) => l.user_id)));
    const clientIds = Array.from(new Set((links ?? []).map((l) => l.client_id)));

    const emailById = new Map<string, string>();
    if (userIds.length) {
      const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      for (const u of usersPage?.users ?? []) {
        if (userIds.includes(u.id)) emailById.set(u.id, u.email ?? "");
      }
    }

    const nameById = new Map<string, string>();
    if (clientIds.length) {
      const { data: clients } = await supabaseAdmin.from("clients").select("id, name").in("id", clientIds);
      for (const c of clients ?? []) nameById.set(c.id, c.name);
    }

    return (links ?? []).map((l) => ({
      id: l.id,
      user_id: l.user_id,
      client_id: l.client_id,
      email: emailById.get(l.user_id) ?? "",
      client_name: nameById.get(l.client_id) ?? "",
      created_at: l.created_at,
    }));
  });
