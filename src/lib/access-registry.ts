// Registro central de chaves de menus e campos usados no controle de acesso
// por Área (menus) e Especialidade (campos da demanda).
//
// As listas são geradas AUTOMATICAMENTE:
// - Menus: a partir dos arquivos de rota em src/routes/_app (todo menu novo
//   aparece sozinho na tela de Perfis e Acessos).
// - Campos: a partir das colunas reais da tabela de demandas (ver
//   deriveFieldRegistry), com rótulos amigáveis quando conhecidos.

export type MenuEntry = { key: string; label: string; group?: string };
export type FieldEntry = { key: string; label: string };

const MENU_LABELS: Record<string, { label: string; group?: string }> = {
  "/dashboard": { label: "Dashboard" },
  "/projects": { label: "Demandas", group: "Operação" },
  "/tickets": { label: "Tickets", group: "Operação" },
  "/calendario": { label: "Calendário", group: "Operação" },
  "/equipamentos": { label: "Equipamentos", group: "Operação" },
  "/tempo": { label: "Tempo", group: "Operação" },
  "/parceiros": { label: "Parceiros", group: "Operação" },
  "/clientes": { label: "Clientes", group: "Cliente" },
  "/clientes/crm": { label: "CRM Prospecção", group: "Cliente" },
  "/financeiro": { label: "Financeiro", group: "Financeiro" },
  "/orcamento": { label: "Orçamento", group: "Financeiro" },
  "/facebook": { label: "Facebook Ads", group: "Marketing" },
  "/diguinho": { label: "Diguinho IA", group: "Marketing" },
  "/team": { label: "Equipe", group: "Squad" },
  "/squad": { label: "Times", group: "Squad" },
  "/squad/relatorio": { label: "Relatório do Squad", group: "Squad" },
  "/aprovacoes": { label: "Aprovações", group: "Squad" },
  "/acessos": { label: "Perfis e Acessos", group: "Squad" },
  "/cadastros": { label: "Cadastros", group: "Configurações" },
  "/integracoes": { label: "Integrações", group: "Configurações" },
  "/personalizacao": { label: "Personalização", group: "Configurações" },
};

function humanize(segment: string) {
  const s = segment.replace(/[-_]/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildMenuRegistry(): MenuEntry[] {
  // Vite resolve isto em build-time: qualquer rota nova entra automaticamente.
  const modules = import.meta.glob("/src/routes/_app/**/*.tsx");
  const files = Object.keys(modules).map((p) =>
    p.replace("/src/routes/_app/", "").replace(/\.tsx$/, ""),
  );

  const layoutParents = new Set(
    files.filter((f) => f.endsWith(".index")).map((f) => f.slice(0, -".index".length)),
  );

  const keys = new Set<string>();
  for (const f of files) {
    const base = f.endsWith(".index") ? f.slice(0, -".index".length) : f;
    if (!base) continue;
    // Arquivo que é apenas layout de um grupo (ex.: squad.tsx com squad.index.tsx)
    if (!f.endsWith(".index") && layoutParents.has(f)) continue;
    keys.add("/" + base.split(/[./]/).filter(Boolean).join("/"));
  }

  return Array.from(keys)
    .sort()
    .map((key) => {
      const known = MENU_LABELS[key];
      const last = key.split("/").filter(Boolean).pop() ?? key;
      return { key, label: known?.label ?? humanize(last), group: known?.group ?? "Geral" };
    });
}

export const MENU_REGISTRY: MenuEntry[] = buildMenuRegistry();

// ---------------------------------------------------------------------------
// Campos da demanda
// ---------------------------------------------------------------------------

export const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  client_id: "Cliente",
  media_type: "Tipo de mídia",
  media_type_id: "Tipo de mídia",
  priority: "Prioridade",
  priority_id: "Prioridade",
  status_id: "Etapa",
  team_id: "Equipe responsável",
  due_date: "Prazo",
  post_date: "Data de postagem",
  start_date: "Data de início",
  budget: "Orçamento / Custo",
  notes: "Direção de arte",
  caption: "Legenda",
  description: "Descrição",
  description_cards: "Cards de descrição",
  reference_links: "Links de referência",
  has_reference: "Possui referência",
  deliverable_path: "Anexo entregável",
  final_link: "Arquivo ou link finalizado",
  client_feedback: "Feedback do cliente",
  client_decision: "Decisão do cliente",
  assignees: "Responsáveis",
  service_type: "Tipo de serviço",
  client_name: "Nome do cliente (legado)",
};

// Colunas internas que nunca entram no controle de visibilidade.
const INTERNAL_FIELDS = new Set([
  "id",
  "created_at",
  "updated_at",
  "created_by",
  "assigned_to",
  "client_token",
  "client_decided_at",
  "status",
]);

/** Lista base (sempre presente) de campos liberáveis. */
export const FIELD_REGISTRY: FieldEntry[] = [
  "title",
  "client_id",
  "media_type",
  "priority",
  "due_date",
  "post_date",
  "budget",
  "notes",
  "caption",
  "description",
  "description_cards",
  "reference_links",
  "deliverable_path",
  "final_link",
  "client_feedback",
  "assignees",
].map((key) => ({ key, label: FIELD_LABELS[key] ?? humanize(key) }));

/**
 * Combina os campos base com as colunas reais vindas do banco, para que
 * qualquer campo novo criado na tabela de demandas apareça automaticamente.
 */
export function deriveFieldRegistry(columns: string[] | null | undefined): FieldEntry[] {
  const out = new Map<string, FieldEntry>();
  for (const f of FIELD_REGISTRY) out.set(f.key, f);
  for (const c of columns ?? []) {
    if (INTERNAL_FIELDS.has(c) || out.has(c)) continue;
    // Evita duplicar variações já cobertas (media_type_id vs media_type…)
    if (c.endsWith("_id") && out.has(c.replace(/_id$/, ""))) continue;
    out.set(c, { key: c, label: FIELD_LABELS[c] ?? humanize(c) });
  }
  return Array.from(out.values());
}
