import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitRegistration } from "@/lib/registration.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Briefcase, ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/cadastro/usuario")({ component: CadastroUsuarioPage });

function CadastroUsuarioPage() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const send = useServerFn(submitRegistration);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password.length < 8) return toast.error("A senha deve ter pelo menos 8 caracteres.");
    if (password !== confirm) return toast.error("As senhas não coincidem.");
    setBusy(true);
    try {
      await send({
        data: {
          type: "usuario",
          email: String(fd.get("email")).trim().toLowerCase(),
          full_name: String(fd.get("full_name")).trim(),
          phone: String(fd.get("phone") ?? "").trim() || null,
          notes: String(fd.get("notes") ?? "").trim() || null,
          password,
        },
      });
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o cadastro.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <PageShell>
        <Card className="p-8 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">Cadastro enviado</h2>
          <p className="text-sm text-muted-foreground">
            Sua solicitação foi enviada para aprovação. Aguarde que um administrador libere seu acesso — você receberá um e-mail com o link para criar sua senha.
          </p>
          <Button asChild variant="outline"><Link to="/login">Voltar ao login</Link></Button>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Card className="p-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Cadastro de Usuário</h2>
            <p className="text-xs text-muted-foreground">Colaborador/agência. Depende de aprovação.</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1"><Label htmlFor="full_name">Nome completo *</Label><Input id="full_name" name="full_name" required /></div>
          <div className="space-y-1"><Label htmlFor="email">E-mail *</Label><Input id="email" name="email" type="email" required /></div>
          <div className="space-y-1"><Label htmlFor="phone">Telefone</Label><Input id="phone" name="phone" /></div>
          <div className="space-y-1"><Label htmlFor="notes">Área / Função desejada</Label><Textarea id="notes" name="notes" rows={3} placeholder="Ex.: designer, redator, gerente..." /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Enviando..." : "Enviar cadastro"}</Button>
        </form>
      </Card>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-3">
        <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login
        </Link>
        {children}
      </div>
    </div>
  );
}
