
## Objetivo

Criar uma página pública (sem login) onde qualquer pessoa com o link possa abrir uma solicitação. O pedido entra em uma **fila de aprovação** dentro do sistema; um gerente revisa e converte (ou recusa) o ticket em projeto no Kanban.

## Fluxo

```text
Cliente → /ticket (público) → submit → tabela ticket_requests (status: pendente)
                                              │
                                  Gerente acessa /tickets (interno)
                                              │
                              Aprovar ──► cria projeto + move anexos → status: aprovado
                              Recusar ──► registra motivo               → status: recusado
```

## Banco de dados (migration)

**Tabela `ticket_requests`**
- Identificação: `requester_name`, `requester_email`, `requester_phone`, `company`
- Conteúdo: `title`, `description`, `media_type_id` (FK opcional), `desired_due_date`, `reference_links` (text[])
- Anexos: `attachments` (jsonb com `{path, name, size, mime}`)
- Workflow: `status` ('pendente' | 'aprovado' | 'recusado'), `review_notes`, `reviewed_by`, `reviewed_at`, `created_project_id`
- Padrão: `id`, `created_at`

**RLS**
- INSERT: público (`anon` + `authenticated`) — qualquer um envia
- SELECT/UPDATE/DELETE: apenas `is_manager(auth.uid())`

**Storage**
- Novo bucket privado `ticket-attachments`
- Policy de INSERT pública (anon pode subir em `public/<uuid>/...`)
- SELECT/DELETE só para managers

**Permissões**
- Novo recurso `tickets` em `role_permissions` (view para admin/gerente)

## Backend (server functions)

`src/lib/tickets.functions.ts`
- `submitTicket` — público, sem auth middleware. Valida com Zod (limites de tamanho), insere em `ticket_requests`. Recebe paths de anexos já enviados.
- `uploadTicketAttachment` — público, recebe FormData, valida mime/tamanho (máx 10MB, até 5 arquivos), grava no bucket usando `supabaseAdmin`, retorna o path.
- `approveTicket` — manager only: cria registro em `projects` (status inicial, copia título/descrição/media_type/links/due_date), move anexos para `project-files`, cria registros em `project_attachments`, marca request como aprovado com `created_project_id`.
- `rejectTicket` — manager only: salva `review_notes` e marca recusado.
- `listTicketRequests` — manager only, com filtro por status.

## Rotas

**Pública** — `src/routes/ticket.tsx`
- Sem layout `_app`, design alinhado ao sistema (mesmo card/tipografia da tela de login)
- Form com: nome, e-mail, telefone, empresa, título, descrição, tipo de mídia (select carregado de `media_types`), prazo desejado, links de referência (lista dinâmica), uploader de até 5 anexos
- Validação client-side (zod + react-hook-form), feedback de sucesso com mensagem "Recebemos sua solicitação"
- SEO: title/description próprios

**Interna** — `src/routes/_app/tickets.tsx`
- Lista de solicitações com tabs: Pendentes / Aprovadas / Recusadas
- Cada item abre Sheet com detalhes, anexos para download e botões **Aprovar** (cria projeto e redireciona para `/projects`) ou **Recusar** (textarea de motivo)
- Item de menu na sidebar (`Tickets`, ícone Inbox), visível conforme permissão

## Pontos de UI/UX

- Página pública compacta, responsiva, sem sidebar; logo + título "Abrir solicitação"
- Após envio: tela de confirmação com opção "enviar outra"
- Uploader mostra progresso por arquivo e bloqueia submit enquanto sobe
- Badge na sidebar com contagem de pendentes (consulta leve via server fn)

## Itens fora do escopo desta fase

- Notificações por e-mail / Diguinho ao receber ticket (pode entrar depois)
- Branding customizável por cliente
- Link individual por cliente (token) — fica para uma evolução futura

Posso seguir com a implementação?
