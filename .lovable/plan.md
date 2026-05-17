# Plano

## 1. Calendário interno: clicar na tarefa abre detalhes

No `/calendario`, hoje clicar redireciona para `/projects`. Vou:

- Criar `ProjectDetailDialog` (modal reutilizável) mostrando título, cliente, tipo de mídia, etapa, prioridade, prazo, data de postagem, descrição, notas, links de referência, decisão do cliente.
- Botão **"Editar"** dentro do modal abre o dialog completo de edição já existente em `/_app/projects.tsx` (vou extrair o `ProjectFormDialog` para `src/components/project-form-dialog.tsx` para poder reutilizar). Só aparece se `can("projects","edit")`.
- Botão "Abrir em Projetos" como alternativa.
- Clique no evento do calendário abre o modal de detalhes em vez de navegar.

## 2. Portal do cliente

### 2.1 Modelo de acesso

- Novo papel `cliente` no enum `app_role`.
- Tabela `client_users` ligando `auth.users.id` ↔ `clients.id` (um usuário pode ver 1 ou mais clientes).
- Login pelo `/login` existente. Após login, se o usuário tem papel `cliente`, redireciona para `/portal` (em vez de `/dashboard`).
- Cadastro de usuário-cliente feito por gerente/admin numa nova aba em `/cadastros` → "Acesso de clientes": informa email + cliente vinculado, dispara convite (signUp + senha temporária ou magic link).

### 2.2 Rotas do portal (layout `_portal`)

```
src/routes/_portal.tsx          → guard: exige papel "cliente", carrega clients vinculados
src/routes/_portal/index.tsx    → redirect p/ /portal/calendario
src/routes/_portal/calendario.tsx → calendário mensal (filtros: mês, cliente se >1, tipo de mídia)
src/routes/_portal/pendentes.tsx  → lista de materiais aguardando aprovação
src/routes/_portal/aprovados.tsx  → lista de materiais aprovados
```

Layout próprio (header simples com logo do branding + nome do cliente + sair), sem o sidebar interno.

### 2.3 Conteúdo de cada área

- **Calendário**: mesma grade do interno, mas mostra só `projects` dos `client_id` vinculados. Filtro por mês (navegação ←/→) e dropdown de tipo de mídia. Clicar abre modal somente-leitura com preview do entregável (se houver `deliverable_path`, link assinado do bucket `project-files`) e os links de referência.
- **Pendentes de aprovação**: `projects` cujo `status_id` aponta para `workflow_statuses.is_client_validation = true` e `client_decision IS NULL`. Cada card tem botões **Aprovar** / **Reprovar** com campo de feedback, reusando a função existente `submit_client_decision` (adaptando para autenticação por user em vez de token — nova função `submit_client_decision_authed(_project_id, _decision, _feedback)` com checagem de vínculo).
- **Aprovados**: `client_decision = 'aprovado'`, ordenado por `client_decided_at desc`.

### 2.4 Segurança (RLS)

Novas policies em `projects` (e `workflow_statuses`, `media_types`, `clients`, `project_attachments`) permitindo SELECT para usuários com papel `cliente` cujo `client_users.client_id = projects.client_id`. Função `has_client_access(_uid, _client_id)` SECURITY DEFINER.

## Mudanças por arquivo

**Banco (migração):**

- ALTER TYPE `app_role` ADD VALUE `'cliente'`
- CREATE TABLE `client_users (user_id, client_id, created_at)` + RLS (admin/gerente gerenciam, usuário vê os próprios vínculos)
- Função `has_client_access(uuid, uuid)`
- Função `submit_client_decision_authed(uuid, text, text)`
- Policies "client portal" em `projects`, `clients`, `media_types`, `workflow_statuses`, `project_attachments`

**Código:**

- `src/components/project-detail-dialog.tsx` (novo, reutilizável)
- `src/components/project-form-dialog.tsx` (extraído de projects.tsx)
- `src/routes/_app/calendario.tsx` (clique → abre dialog)
- `src/routes/_app/projects.tsx` (refatorar para usar form extraído)
- `src/routes/_app/cadastros.tsx` (aba "Acesso de clientes")
- `src/routes/_portal.tsx`, `_portal/calendario.tsx`, `_portal/pendentes.tsx`, `_portal/aprovados.tsx`
- `src/routes/login.tsx` (redirect condicional por papel)
- `src/lib/permissions.tsx` (adiciona role `cliente`, sem acesso aos recursos internos)
- `src/lib/auth-context.tsx` (expor helper `isClient`)

## Fora de escopo

- Notificação por email ao cliente (já existe infra de email; pode ser adicionado depois).
- Anexos enviados pelo próprio cliente.

Confirma para eu implementar?