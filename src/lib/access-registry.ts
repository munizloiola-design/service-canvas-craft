// Registro central de chaves de menus e campos usados no controle de acesso
// por Área (menus) e Especialidade (campos da demanda).

export const MENU_REGISTRY: { key: string; label: string; group?: string }[] = [
  { key: "/dashboard", label: "Dashboard" },
  { key: "/projects", label: "Projetos", group: "Operação" },
  { key: "/tickets", label: "Tickets", group: "Operação" },
  { key: "/calendario", label: "Calendário", group: "Operação" },
  { key: "/clientes-area", label: "Área do Cliente", group: "Operação" },
  { key: "/equipamentos", label: "Equipamentos", group: "Operação" },
  { key: "/tempo", label: "Tempo", group: "Operação" },
  { key: "/financeiro", label: "Financeiro", group: "Financeiro" },
  { key: "/orcamento", label: "Orçamento", group: "Financeiro" },
  { key: "/facebook", label: "Facebook Ads", group: "Marketing" },
  { key: "/diguinho", label: "Diguinho IA", group: "Marketing" },
  { key: "/team", label: "Equipe" },
  { key: "/aprovacoes", label: "Aprovações" },
  { key: "/cadastros", label: "Cadastros", group: "Configurações" },
  { key: "/integracoes", label: "Integrações", group: "Configurações" },
  { key: "/personalizacao", label: "Personalização", group: "Configurações" },
];

export const FIELD_REGISTRY: { key: string; label: string }[] = [
  { key: "title", label: "Título" },
  { key: "client_id", label: "Cliente" },
  { key: "media_type", label: "Tipo de mídia" },
  { key: "priority", label: "Prioridade" },
  { key: "due_date", label: "Prazo" },
  { key: "post_date", label: "Data de postagem" },
  { key: "budget", label: "Orçamento / Custo" },
  { key: "notes", label: "Direção de arte" },
  { key: "description", label: "Descrição" },
  { key: "description_cards", label: "Cards de descrição" },
  { key: "reference_links", label: "Links de referência" },
  { key: "deliverable_path", label: "Anexo entregável" },
  { key: "final_link", label: "Arquivo ou link finalizado" },
  { key: "client_feedback", label: "Feedback do cliente" },
  { key: "assignees", label: "Responsáveis" },
];
