import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { TeamsPanel } from "@/components/squad/TeamsPanel";

export const Route = createFileRoute("/_app/squad")({ component: SquadPage });

function SquadPage() {
  const { isManager } = useAuth();
  if (!isManager) {
    return <div className="p-8"><p className="text-muted-foreground">Apenas administradores e gerentes podem acessar.</p></div>;
  }
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Squad</h1>
        <p className="text-muted-foreground mt-1">Monte squads por cliente. Ao criar uma demanda, os membros da equipe padrão são preenchidos automaticamente.</p>
      </header>
      <TeamsPanel />
    </div>
  );
}
