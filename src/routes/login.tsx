import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Briefcase } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, signIn, signUp, loading, isClient } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to={isClient ? "/portal/calendario" : "/dashboard"} />;

  const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await signIn(String(fd.get("email")), String(fd.get("password")));
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Bem-vindo!");
    // navigation handled by Navigate above when roles load
  };

  const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await signUp(
      String(fd.get("email")),
      String(fd.get("password")),
      String(fd.get("fullName")),
    );
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Conta criada! Você já pode entrar.");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Briefcase className="h-6 w-6" />
          Equipe.io
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Gestão de equipe e<br />serviços, simplificada.
          </h1>
          <p className="mt-4 text-primary-foreground/80 max-w-md">
            Receba demandas, acompanhe projetos em um quadro Kanban e visualize o desempenho da sua equipe — tudo em um só lugar.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© {new Date().getFullYear()} Equipe.io</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8">
          <div className="lg:hidden flex items-center gap-2 mb-6 text-lg font-semibold">
            <Briefcase className="h-6 w-6 text-primary" />
            Equipe.io
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Acesse sua conta</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            Entre ou crie uma conta para começar.
          </p>

          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" name="password" type="password" required autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input id="fullName" name="fullName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">E-mail</Label>
                  <Input id="su-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-password">Senha</Label>
                  <Input id="su-password" name="password" type="password" required minLength={6} autoComplete="new-password" />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Criando..." : "Criar conta"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  O primeiro usuário cadastrado se torna administrador.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
