import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BAN_FOREVER = "876000h";

const schema = z.object({
  type: z.enum(["cliente", "usuario"]),
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  company_name: z.string().trim().max(160).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  password: z.string().min(8).max(72),
});

export const submitRegistration = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => schema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const email = data.email.toLowerCase();

    const { data: created, error: e1 } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (e1 || !created?.user) {
      const msg = (e1?.message ?? "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        throw new Error("Já existe uma conta com este e-mail. Use a opção Entrar ou Esqueci minha senha.");
      }
      throw new Error(e1?.message ?? "Não foi possível criar o cadastro.");
    }
    const uid = created.user.id;

    // Bloqueia o acesso até a aprovação
    await supabaseAdmin.auth.admin.updateUserById(uid, { ban_duration: BAN_FOREVER });

    // Sem papel até a aprovação
    await admin.from("user_roles").delete().eq("user_id", uid);

    await admin.from("profiles").update({
      full_name: data.full_name,
      phone: data.phone ?? null,
    }).eq("id", uid);

    const { error: e2 } = await admin.from("pending_registrations").insert({
      type: data.type,
      email,
      full_name: data.full_name,
      company_name: data.company_name ?? null,
      phone: data.phone ?? null,
      notes: data.notes ?? null,
      status: "pending",
      auth_user_id: uid,
    });
    if (e2) throw new Error(e2.message);

    return { success: true };
  });
