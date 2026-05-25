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
