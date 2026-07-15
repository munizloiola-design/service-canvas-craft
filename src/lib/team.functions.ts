import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export const deleteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { userId } = data;

    // Verify actor is admin
    const { data: me } = await supabase.auth.getUser();
    const actorId = me.user?.id;
    if (!actorId) throw new Error("Não autenticado");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", actorId);
    const isAdmin =
      roles?.some(
        (r) => r.role === "admin" || r.role === "admin_master"
      ) ?? false;
    if (!isAdmin) throw new Error("Sem permissão");

    // Prevent self-deletion
    if (userId === actorId) throw new Error("Não pode excluir a si mesmo");

    // Delete related data first
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_functions").delete().eq("user_id", userId);
    await supabaseAdmin.from("team_private_notes").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);
    await supabaseAdmin.from("dashboard_widgets").delete().eq("user_id", userId);
    await supabaseAdmin.from("diguinho_messages").delete().eq("user_id", userId);
    await supabaseAdmin.from("integration_meta").delete().eq("user_id", userId);
    await supabaseAdmin.from("budget_simulations").delete().eq("created_by", userId);

    // Delete auth user (requires admin/service role)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;

    return { success: true };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(ctx: { supabase: any }) {
  const { data: me } = await ctx.supabase.auth.getUser();
  const actorId = me.user?.id as string | undefined;
  if (!actorId) throw new Error("Não autenticado");
  const { data: roles } = await ctx.supabase.from("user_roles").select("role").eq("user_id", actorId);
  const isAdmin = roles?.some((r: { role: string }) => r.role === "admin" || r.role === "admin_master") ?? false;
  if (!isAdmin) throw new Error("Sem permissão");
  return actorId;
}


export const setUserBanned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), banned: z.boolean() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const actorId = await assertAdmin(context);
    if (data.userId === actorId) throw new Error("Não pode bloquear a si mesmo");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.banned ? "876000h" : "none",
    });
    if (error) throw error;
    return { success: true, banned: data.banned };
  });

export const listBannedUserIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const banned: string[] = [];
    let page = 1;
    while (page < 20) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const users = data?.users ?? [];
      for (const u of users) {
        const until = (u as unknown as { banned_until?: string | null }).banned_until;
        if (until && new Date(until).getTime() > Date.now()) banned.push(u.id);
      }
      if (users.length < 200) break;
      page++;
    }
    return banned;
  });

