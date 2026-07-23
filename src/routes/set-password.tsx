import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { describeSupabaseError } from "@/lib/supabase-error";

export const Route = createFileRoute("/set-password")({
  head: () => ({ meta: [{ title: "Criar nova senha" }] }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [busy, setBusy] = useState(false);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    // Supabase auto-parses the hash (detectSessionInUrl). Give it a tick, then check.
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setStatus(data.session ? "ready" : "invalid");
    };
    // Wait for the initial URL parse via onAuthStateChange, fallback poll.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (cancelled) return;
      if (session) setStatus("ready");
    });
    const t = window.setTimeout(check, 400);
    return () => { cancelled = true; window.clearTimeout(t); sub.subscription.unsubscribe(); };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("A senha deve ter pelo menos 8 caracteres.");
    if (pwd !== confirm) return toast.error("As senhas não conferem.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success("Senha definida com sucesso!");

      // Decide destination by role
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      let isClient = false;
      if (uid) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
        isClient = (roles ?? []).some((r) => r.role === "cliente");
      }
      navigate({ to: isClient ? "/portal" : "/dashboard", replace: true });
    } catch (err) {
      console.error("[set-password]", err);
      toast.error(describeSupabaseError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Definir nova senha</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Escolha uma senha para acessar sua conta.
          </p>
        </div>

        {status === "checking" && (
          <p className="text-sm text-muted-foreground">Validando link…</p>
        )}

        {status === "invalid" && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              Link inválido ou expirado. Solicite um novo convite ou uma nova recuperação de senha.
            </p>
            <Button variant="outline" onClick={() => navigate({ to: "/login" })}>Voltar ao login</Button>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pwd">Nova senha</Label>
              <Input
                id="pwd"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input
                id="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Salvando…" : "Salvar senha"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
