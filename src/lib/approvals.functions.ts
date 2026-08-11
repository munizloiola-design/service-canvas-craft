import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertManager(ctx: any) {
  const { data } = await ctx.supabase.rpc("is_manager", { _uid: ctx.userId });
  if (!data) throw new Error("Sem permissão");
}

const FALLBACK_BASE_URL = "https://workflow.digcomunicacao.com.br";

function setPasswordRedirect(baseUrl?: string) {
  const base = (baseUrl ?? FALLBACK_BASE_URL).replace(/\/+$/, "");
  return `${base}/set-password`;
}

export const approveRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), base_url: z.string().url().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    const { data: reg, error: e1 } = await admin.from("pending_registrations").select("*").eq("id", data.id).single();
    if (e1 || !reg) throw new Error("Cadastro não encontrado");
    if (reg.status !== "pending") throw new Error("Cadastro já processado");

    const { data: created, error: e2 } = await supabaseAdmin.auth.admin.createUser({
      email: reg.email,
      email_confirm: true,
      user_metadata: { full_name: reg.full_name },
    });
    if (e2 || !created.user) throw new Error(e2?.message ?? "Falha ao criar usuário");
    const uid = created.user.id;

    const { data: linkData, error: e3 } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: reg.email,
      options: { redirectTo: setPasswordRedirect(data.base_url) },
    });
    if (e3) throw new Error(e3.message);
    const actionLink = linkData?.properties?.action_link ?? null;
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    if (reg.type === "cliente") {
      await admin.from("user_roles").delete().eq("user_id", uid);
      await admin.from("user_roles").insert({ user_id: uid, role: "cliente" });
      const { data: cli, error: e4 } = await admin
        .from("clients")
        .insert({
          name: reg.company_name || reg.full_name,
          email: reg.email,
          phone: reg.phone,
        })
        .select("id")
        .single();
      if (e4) throw new Error(e4.message);
      await admin.from("client_users").insert({ user_id: uid, client_id: cli.id });
    }

    await admin
      .from("profiles")
      .update({
        full_name: reg.full_name,
        phone: reg.phone ?? null,
        password_setup_link: actionLink,
        password_setup_expires_at: expiresAt,
      })
      .eq("id", uid);

    await admin
      .from("pending_registrations")
      .update({
        status: "approved",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    return { success: true, action_link: actionLink, user_id: uid };
  });

export const rejectRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const { error } = await admin
      .from("pending_registrations")
      .update({
        status: "rejected",
        rejection_reason: data.reason ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const createTeamUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        email: z.string().email(),
        full_name: z.string().min(1).max(120),
        phone: z.string().max(30).optional(),
        role: z.enum(["admin", "gerente", "membro"]).default("membro"),
        base_url: z.string().url().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    const { data: created, error: e1 } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (e1 || !created.user) throw new Error(e1?.message ?? "Falha ao criar usuário");
    const uid = created.user.id;

    // Ensure requested role
    await admin.from("user_roles").delete().eq("user_id", uid);
    await admin.from("user_roles").insert({ user_id: uid, role: data.role });

    const { data: linkData, error: e2 } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
      options: { redirectTo: setPasswordRedirect(data.base_url) },
    });
    if (e2) throw new Error(e2.message);
    const actionLink = linkData?.properties?.action_link ?? null;
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    await admin
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone ?? null,
        password_setup_link: actionLink,
        password_setup_expires_at: expiresAt,
      })
      .eq("id", uid);

    return { success: true, action_link: actionLink, user_id: uid };
  });

export const regeneratePasswordLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid(), base_url: z.string().url().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const { data: u, error: eu } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    if (eu || !u.user?.email) throw new Error("Usuário não encontrado");
    const { data: linkData, error: el } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: u.user.email,
      options: { redirectTo: setPasswordRedirect(data.base_url) },
    });
    if (el) throw new Error(el.message);
    const actionLink = linkData?.properties?.action_link ?? null;
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await admin
      .from("profiles")
      .update({ password_setup_link: actionLink, password_setup_expires_at: expiresAt })
      .eq("id", data.user_id);
    return { success: true, action_link: actionLink };
  });
