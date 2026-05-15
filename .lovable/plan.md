## Escopo

1. **Editar ticket pendente** (campos do pedido + notas internas)
2. **Personalização global** (logo, nome, favicon, cores) com sugestões prontas
3. **Ações na fila**: excluir, contato via WhatsApp, editar
4. **E-mail de aprovação/recusa** com template editável
5. **Autopreenchimento** do formulário público via localStorage
6. **Bug**: corrigir mismatch de hidratação ("Equipe.io" vs "DIG.FLOW") trocando para o nome configurado

## 1. Banco

**Nova tabela `app_branding`** (single-row, id boolean default true)
- `brand_name`, `logo_url`, `favicon_url`, `primary_color`, `accent_color`, `suggestions` (text), `updated_at`
- RLS: SELECT público (anon+authenticated); INSERT/UPDATE só `is_manager`

**Novo bucket público `brand-assets`** (logo, favicon)
- INSERT/UPDATE/DELETE só managers; SELECT público

**Nova tabela `email_templates`** (key único: `ticket_approved`, `ticket_rejected`)
- `key`, `subject`, `body_html`, `updated_at`
- RLS: SELECT auth; UPDATE/INSERT manager
- Seed com templates default usando variáveis `{{requester_name}}`, `{{title}}`, `{{review_notes}}`, `{{project_link}}`

**Coluna em `ticket_requests`**: `internal_notes` (text, nullable)

**Recurso `branding`** em `role_permissions` (admin/gerente: view, manage)

## 2. Backend

**`src/lib/branding.functions.ts`**
- `getBranding` (público, sem auth) — lê `app_branding`
- `updateBranding` (manager) — salva campos + faz upsert
- `uploadBrandAsset` (manager, FormData) — sobe logo/favicon no `brand-assets`

**`src/lib/tickets.functions.ts`** (estender)
- `updateTicketRequest` (manager): edita `title`, `description`, `media_type_id`, `desired_due_date`, `reference_links`, `internal_notes`
- `deleteTicketRequest` (manager): apaga request + arquivos do `ticket-attachments`
- `approveTicket`/`rejectTicket`: após mudar status, **enfileirar e-mail** via Lovable Emails

**`src/lib/email-templates.functions.ts`**
- `listEmailTemplates`, `updateEmailTemplate` (manager)

## 3. Infraestrutura de e-mail

- Configurar dom\u00ednio `digcomunicacao.com.br` via setup de e-mail do Lovable
- Setup da infra (queue, suppression, unsubscribe)
- Scaffold de transactional emails
- Criar 2 templates React Email: `ticket-approved.tsx` e `ticket-rejected.tsx`
- Templates usam dados do banco (`email_templates`) renderizados no momento do envio — assim o usuário pode editar sujeito/corpo sem mexer em código
- Sem unsubscribe footer customizado (sistema adiciona)

## 4. Rotas / UI

**`/_app/personalizacao`** (nova) — visível por permissão `branding`
- Form: nome do sistema, upload logo/favicon, color pickers (primary/accent), textarea de sugestões
- Aplica `--primary` e `--accent` em runtime via `<style>` injetado no `__root.tsx`
- Atualiza `<title>` e `<link rel="icon">` dinamicamente
- Aba secundária: **Templates de e-mail** (subject + textarea HTML com preview, lista das variáveis disponíveis)

**`/_app/tickets`** (estender)
- Cada ticket pendente ganha 3 botões: **Editar**, **WhatsApp** (abre `https://wa.me/<telefone-sanitizado>`), **Excluir** (confirm dialog)
- Sheet de detalhes ganha modo edição (campos do pedido + textarea de notas internas)
- Aprovar/Recusar mostram aviso "será enviado e-mail para X"

**`/_app.tsx`** sidebar
- Novo item "Personalização" (ícone Palette) com permissão `branding`
- Logo/nome do sistema lidos do `app_branding` (com fallback)

**`/__root.tsx`**
- Carregar `app_branding` server-side e injetar título, favicon e CSS variables — corrige hidratação atual

**`/ticket` (público)**
- Header usa branding global (logo + nome)
- Ao montar: ler `localStorage.ticket_form_autofill` e preencher nome/e-mail/telefone/empresa
- Ao submeter com sucesso: salvar esses 4 campos em localStorage
- Botão discreto "Limpar dados salvos" quando houver autofill

## 5. Detalhes técnicos

- Sanitização do telefone para WhatsApp: remover não-dígitos, prefixar `55` se faltar DDI brasileiro
- Variáveis de template: substituição simples server-side (`String.replaceAll`) — sem HTML do usuário em `dangerouslySetInnerHTML` no app, apenas no e-mail (controlado pelo manager)
- Cores aplicadas convertendo hex → oklch via util e setando em `:root`
- Excluir ticket também remove objetos do bucket `ticket-attachments` (loop com `supabaseAdmin.storage.remove`)

## Fora de escopo (futuro)

- Personalização por cliente
- Link único por cliente com token
- Editor visual rico (WYSIWYG) para templates — fica textarea HTML simples
- Notificações para Diguinho

Posso seguir?
