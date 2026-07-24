import { createFileRoute } from "@tanstack/react-router";
import { CrmTab } from "./clientes.index";

export const Route = createFileRoute("/_app/clientes/crm")({
  head: () => ({
    meta: [
      { title: "CRM Prospecção — Clientes" },
      { name: "description", content: "Pipeline de prospecção de clientes com arraste entre fases." },
      { property: "og:title", content: "CRM Prospecção" },
      { property: "og:description", content: "Pipeline de prospecção de clientes." },
    ],
  }),
  component: CrmPage,
});

function CrmPage() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gradient">CRM Prospecção</h1>
        <p className="text-muted-foreground mt-1">
          Arraste os cards entre fases e acione o WhatsApp direto pelo cartão.
        </p>
      </header>
      <CrmTab />
    </div>
  );
}
