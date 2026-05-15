import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BrandingSchema = z.object({
  brand_name: z.string().min(1).max(80),
  logo_url: z.string().url().nullable().optional(),
  favicon_url: z.string().url().nullable().optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  suggestions: z.string().max(2000).nullable().optional(),
});

export const updateBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BrandingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify manager
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isMgr = (rolesData ?? []).some((r) => r.role === "admin" || r.role === "gerente");
    if (!isMgr) throw new Error("Forbidden");

    const { error } = await supabaseAdmin
      .from("app_branding")
      .upsert({ id: true, ...data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
