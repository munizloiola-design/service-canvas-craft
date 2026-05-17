import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_portal/")({
  component: () => <Navigate to="/portal/calendario" />,
});
