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
// Hierarquia de menus (pai › submenus) para seletores
// ---------------------------------------------------------------------------

export type MenuNode = { entry: MenuEntry; depth: number; selectable: boolean };
export type MenuGroupNodes = { group: string; items: MenuNode[] };

/**
 * Monta a lista de menus agrupada por grupo, com submenus logo abaixo do pai
 * e recuados. Quando `allowed` é informado, apenas menus liberados ficam
 * selecionáveis; pais não liberados aparecem só como rótulo quando algum
 * filho está liberado.
 */
export function menuHierarchy(allowed?: Set<string> | null): MenuGroupNodes[] {
  const keys = MENU_REGISTRY.map((m) => m.key);
  const depthOf = (key: string) => keys.filter((k) => k !== key && key.startsWith(k + "/")).length;

  const ordered = [...MENU_REGISTRY].sort((a, b) => a.key.localeCompare(b.key));
  const groups = new Map<string, MenuNode[]>();

  for (const entry of ordered) {
    const selectable = !allowed || allowed.has(entry.key);
    const hasAllowedChild =
      !allowed || keys.some((k) => k.startsWith(entry.key + "/") && allowed.has(k));
    if (!selectable && !hasAllowedChild) continue;
    const group = entry.group ?? "Geral";
    const list = groups.get(group) ?? [];
    list.push({ entry, depth: depthOf(entry.key), selectable });
    groups.set(group, list);
  }

  return Array.from(groups.entries()).map(([group, items]) => ({ group, items }));
}

// ---------------------------------------------------------------------------
// Seções (abas) de cada menu — liberação por Especialidade
// ---------------------------------------------------------------------------

export type SectionEntry = { id: string; label: string };

export const SECTION_REGISTRY: Record<string, SectionEntry[]> = {
  "/clientes": [
    { id: "diretorio", label: "Diretório" },
    { id: "acessos", label: "Acessos do portal" },
    { id: "briefing", label: "Briefing & Estratégia" },
    { id: "projetos", label: "Projetos ativos" },
  ],
  "/financeiro": [
    { id: "dashboard", label: "Dashboard" },
    { id: "custos", label: "Custos fixos" },
    { id: "recorrentes", label: "Receitas recorrentes" },
    { id: "lancamentos", label: "Lançamentos" },
    { id: "autorizacoes", label: "Autorizações" },
    { id: "solicitacoes", label: "Solicitações" },
    { id: "relatorio", label: "Relatório" },
    { id: "config", label: "Configurações" },
  ],
  "/projects": [
    { id: "kanban", label: "Kanban" },
    { id: "list", label: "Lista" },
  ],
  "/calendario": [
    { id: "month", label: "Visão mês" },
    { id: "week", label: "Visão semana" },
    { id: "due", label: "Datas de entrega" },
    { id: "post", label: "Datas de postagem" },
  ],
  "/tickets": [
    { id: "pendente", label: "Pendentes" },
    { id: "aprovado", label: "Aprovados" },
    { id: "recusado", label: "Recusados" },
  ],
  "/aprovacoes": [
    { id: "pending", label: "Pendentes" },
    { id: "approved", label: "Aprovadas" },
    { id: "rejected", label: "Rejeitadas" },
  ],
  "/tempo": [
    { id: "project", label: "Por projeto" },
    { id: "user", label: "Por usuário" },
    { id: "detail", label: "Detalhado" },
  ],
  "/squad/relatorio": [
    { id: "teams", label: "Times" },
    { id: "members", label: "Membros" },
    { id: "activities", label: "Atividades" },
    { id: "roster", label: "Elenco" },
  ],
  "/team": [
    { id: "ficha", label: "Ficha" },
    { id: "notas", label: "Notas" },
  ],
};

/** Chave usada em specialty_field_visibility para uma seção de menu. */
export function sectionKey(menu: string, section: string) {
  return `menu:${menu}#${section}`;
}

/** Chave de permissão de uma fase (etapa) do Kanban de Demandas. */
export function stageKey(statusId: string) {
  return sectionKey("/projects", `stage:${statusId}`);
}


/** Seções de um menu; menus sem abas ganham um item único de acesso à página. */
export function sectionsForMenu(menu: string): SectionEntry[] {
  return SECTION_REGISTRY[menu] ?? [{ id: "page", label: "Acesso à página" }];
}

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
  // Campos sem interface própria — não fazem sentido na árvore de permissões
  "client_name",
  "service_type",
  "has_reference",
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

// ---------------------------------------------------------------------------
// Árvore única de permissões (menu → seções → campos)
// ---------------------------------------------------------------------------

export type PermItem = { key: string; label: string; kind: "Seção" | "Campo" | "Fase" };
export type PermMenu = {
  entry: MenuEntry;
  depth: number;
  areaAllowed: boolean;
  items: PermItem[];
};
export type PermGroup = { group: string; menus: PermMenu[] };

/** Menu que possui campos além das abas (hoje apenas Demandas). */
const FIELD_MENU = "/projects";

/**
 * Monta a árvore completa usada na tela de Perfis e Acessos: todos os menus
 * (com indicação de liberado ou não para a Área) e, dentro de cada um, as
 * abas/seções e — em Demandas — as fases do Kanban e os campos da demanda.
 */
export function permissionTree(
  areaAllowed: Set<string>,
  projectColumns?: string[] | null,
  stages?: { id: string; name: string }[] | null,
): PermGroup[] {
  const keys = MENU_REGISTRY.map((m) => m.key);
  const depthOf = (key: string) => keys.filter((k) => k !== key && key.startsWith(k + "/")).length;

  const groups = new Map<string, PermMenu[]>();
  for (const entry of [...MENU_REGISTRY].sort((a, b) => a.key.localeCompare(b.key))) {
    const items: PermItem[] = sectionsForMenu(entry.key).map((s) => ({
      key: sectionKey(entry.key, s.id),
      label: s.label,
      kind: "Seção",
    }));
    if (entry.key === FIELD_MENU) {
      (stages ?? []).forEach((s, idx) => {
        items.push({ key: stageKey(s.id), label: `${idx + 1}. ${s.name}`, kind: "Fase" });
      });
      for (const f of deriveFieldRegistry(projectColumns)) {
        items.push({ key: f.key, label: f.label, kind: "Campo" });
      }
    }
    const group = entry.group ?? "Geral";
    const list = groups.get(group) ?? [];
    list.push({ entry, depth: depthOf(entry.key), areaAllowed: areaAllowed.has(entry.key), items });
    groups.set(group, list);
  }
  return Array.from(groups.entries()).map(([group, menus]) => ({ group, menus }));
}

