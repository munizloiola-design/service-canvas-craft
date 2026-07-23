import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { useBranding } from "@/lib/branding-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Briefcase, Building2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

type Kind = "cliente" | "agencia";

function LoginPage() {
  const { user, loading, isClient } = useAuth();
  const { branding } = useBranding();
  const [kind, setKind] = useState<Kind | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  if (!loading && user) return <Navigate to={isClient ? "/portal" : "/dashboard"} />;

  const switchStep = (next: Kind | null) => {
    setLeaving(true);
    window.setTimeout(() => {
      setKind(next);
      setLeaving(false);
    }, 180);
  };

  async function onSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!kind) return;
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email")).trim().toLowerCase();
    const password = String(fd.get("password"));
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setBusy(false);
      return toast.error(error?.message ?? "Falha no login");
    }
    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const roles = (rolesData ?? []).map((r) => r.role as string);
    const isCli = roles.includes("cliente");
    setBusy(false);
    if (kind === "cliente" && !isCli) {
      await supabase.auth.signOut();
      return toast.error("Esta conta não é de cliente. Selecione 'Agência'.");
    }
    if (kind === "agencia" && isCli) {
      await supabase.auth.signOut();
      return toast.error("Esta é uma conta de cliente. Selecione 'Cliente'.");
    }
    toast.success("Bem-vindo!");
  }

  const justify =
    branding.login_box_position === "left"
      ? "justify-start"
      : branding.login_box_position === "center"
      ? "justify-center"
      : "justify-end";

  const bgStyle = branding.background_image
    ? { backgroundImage: `url(${branding.background_image})` }
    : undefined;

  const stepAnim = leaving
    ? "motion-safe:animate-fade-out opacity-0"
    : "motion-safe:animate-fade-in motion-safe:animate-scale-in";

  return (
    <div
      className={`min-h-screen w-full flex ${justify} items-center bg-cover bg-center bg-no-repeat transition-opacity duration-500 ${
        branding.background_image ? "" : "bg-background"
      }`}
      style={bgStyle}
    >
      {!branding.background_image && (
        <div className="hidden lg:flex absolute inset-y-0 left-0 w-1/2 flex-col justify-between p-12 bg-primary text-primary-foreground motion-safe:animate-fade-in">
          <div className="flex items-center gap-2 text-lg font-semibold">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt="logo" className="h-7 w-7 rounded object-contain" />
            ) : (
              <Briefcase className="h-6 w-6" />
            )}
            {branding.brand_name}
          </div>
          <div>
            <h1 className="text-4xl font-bold leading-tight">Portal de Clientes e Agência.</h1>
            <p className="mt-4 text-primary-foreground/80 max-w-md">
              Escolha como deseja entrar. Clientes acompanham entregas e aprovam; agências e colaboradores gerenciam o fluxo completo.
            </p>
          </div>
          <p className="text-xs text-primary-foreground/60">© {new Date().getFullYear()} {branding.brand_name}</p>
        </div>
      )}

      <div className={`w-full flex ${justify} p-6 ${!branding.background_image ? "lg:pl-[50%]" : ""}`}>
        <Card
          className={`w-full max-w-md p-8 rounded-3xl glass-strong motion-safe:animate-fade-in motion-safe:animate-scale-in transition-all duration-300`}
        >
          <div
            key={kind ?? "choose"}
            className={`${stepAnim} transition-opacity duration-200`}
          >
            {!kind && (
              <>
                <h2 className="text-2xl font-semibold tracking-tight text-center motion-safe:animate-fade-in text-gradient">
                  {branding.welcome_title}
                </h2>
                <p
                  className="text-sm text-muted-foreground text-center mt-1 mb-6 motion-safe:animate-fade-in"
                  style={{ animationDelay: "60ms", animationFillMode: "backwards" }}
                >
                  {branding.welcome_subtitle}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <ChoiceCard
                    icon={Building2}
                    label="Cliente"
                    desc="Acesso ao portal de aprovações"
                    onClick={() => switchStep("cliente")}
                    delay={120}
                  />
                  <ChoiceCard
                    icon={Briefcase}
                    label="Agência"
                    desc="Colaboradores e gestores"
                    onClick={() => switchStep("agencia")}
                    delay={200}
                  />
                </div>
                <div
                  className="mt-8 pt-6 border-t space-y-2 text-center text-sm motion-safe:animate-fade-in"
                  style={{ animationDelay: "280ms", animationFillMode: "backwards" }}
                >
                  <p className="text-muted-foreground">Ainda não tem cadastro?</p>
                  <div className="flex flex-col gap-2">
                    <Button asChild variant="outline" size="sm"><Link to="/cadastro/cliente">Cadastro de Cliente</Link></Button>
                    <Button asChild variant="outline" size="sm"><Link to="/cadastro/usuario">Cadastro de Usuário</Link></Button>
                  </div>
                </div>
              </>
            )}

            {kind && (
              <>
                <button
                  type="button"
                  onClick={() => switchStep(null)}
                  className="group inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
                >
                  <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
                  trocar tipo de acesso
                </button>
                <h2
                  className="text-2xl font-semibold tracking-tight motion-safe:animate-fade-in"
                  style={{ animationFillMode: "backwards" }}
                >
                  Entrar como {kind === "cliente" ? "Cliente" : "Agência"}
                </h2>
                <p
                  className="text-sm text-muted-foreground mt-1 mb-6 motion-safe:animate-fade-in"
                  style={{ animationDelay: "80ms", animationFillMode: "backwards" }}
                >
                  Informe seu e-mail e senha.
                </p>
                <form onSubmit={onSignIn} className="space-y-4">
                  <div
                    className="space-y-2 motion-safe:animate-fade-in"
                    style={{ animationDelay: "120ms", animationFillMode: "backwards" }}
                  >
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div
                    className="space-y-2 motion-safe:animate-fade-in"
                    style={{ animationDelay: "180ms", animationFillMode: "backwards" }}
                  >
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" name="password" type="password" required autoComplete="current-password" />
                  </div>
                  <div
                    className="motion-safe:animate-fade-in"
                    style={{ animationDelay: "240ms", animationFillMode: "backwards" }}
                  >
                    <Button type="submit" className="w-full transition-transform active:scale-[0.98]" disabled={busy}>
                      {busy ? "Entrando..." : "Entrar"}
                    </Button>
                  </div>
                </form>
                <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground">
                  Sem cadastro?{" "}
                  <Link to={kind === "cliente" ? "/cadastro/cliente" : "/cadastro/usuario"} className="text-primary hover:underline">
                    {kind === "cliente" ? "Cadastre-se como cliente" : "Cadastre-se como usuário"}
                  </Link>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ChoiceCard({
  icon: Icon,
  label,
  desc,
  onClick,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  desc: string;
  onClick: () => void;
  delay?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
      className="group rounded-lg border p-5 text-left transition-all duration-300 hover:bg-muted hover:border-primary/60 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] motion-safe:animate-fade-in"
    >
      <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-3 transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110">
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-semibold">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </button>
  );
}
