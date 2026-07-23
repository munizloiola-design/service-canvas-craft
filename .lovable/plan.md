## Escopo

1. **Tela de login com escolha Cliente / Agência** (dois cartões grandes)
2. **Auto-cadastro público** para Cliente e Usuário — **agora com fluxo de aprovação por Admin**
3. **Criar usuário na Equipe** com link para definir senha
4. **Dashboard no portal do Cliente + botão WhatsApp** quando não puder editar o estratégico
5. **Admin visualiza qualquer portal de cliente**
6. **Aba "Contato da empresa"** em Cadastros (WhatsApp de atendimento)
7. **Auto-registro de permissões** para novos recursos

---

## 1. Login (`src/routes/login.tsx`)

- Estado inicial: dois cartões grandes lado a lado — **Cliente** (`Building2`) e **Agência** (`Briefcase`), nome abaixo do ícone.
- Ao clicar, mostra o formulário de login correspondente com botão "Voltar" para trocar.
- Remove aba "Criar conta".
- Rodapé do card: links **"Cadastrar novo cliente"** → `/cadastro/cliente` e **"Cadastrar novo usuário"** → `/cadastro/usuario`.
- Valida papel após `signIn`:
  - Botão Cliente → só se `isClient`; senão `signOut` + toast.
  - Botão Agência → só se não for `isClient`; senão `signOut` + toast.
- Se conta ainda **pendente de aprovação** → `signOut` + toast "Cadastro aguardando aprovação do administrador".
- Redirect: cliente → `/portal`, agência → `/dashboard`.

## 2. Cadastros públicos com aprovação

**Nova tabela** `pending_registrations` (não cria auth user até aprovação):

- Campos: `id`, `type` (`cliente` | `usuario`), `full_name`, `email`, `password_hash` (bcrypt), `company_name` (opcional para cliente), `phone`, `status` (`pending` | `approved` | `rejected`), `requested_role` (para usuário), `reviewed_by`, `reviewed_at`, `rejection_reason`, `created_at`.
- RLS: qualquer um pode inserir (anon); apenas admin/gerente lê/atualiza.

**Novas rotas públicas**:
- `src/routes/cadastro.cliente.tsx`: nome, email, empresa, senha → cria linha em `pending_registrations` via server fn pública `submitPublicRegistration` (zod, hash bcrypt server-side, sem `requireSupabaseAuth`). Toast: "Cadastro enviado! Você receberá acesso após aprovação."
- `src/routes/cadastro.usuario.tsx`: nome, email, senha → mesmo fluxo com `type='usuario'`.

**Nova tela de aprovação** `src/routes/_app/aprovacoes.tsx` (item no menu, permissão `aprovacoes.view`):
- Lista pendentes com abas "Clientes" / "Usuários".
- Ações: **Aprovar** (chama `approveRegistration` — cria auth user via `supabaseAdmin.auth.admin.createUser` com a senha original, insere `profiles`/`clients`/`client_users`/`user_roles` conforme tipo, marca `approved`) ou **Rejeitar** com motivo.
- Badge no menu com contagem de pendentes.

## 3. Criar usuário na Equipe

- Botão "Novo usuário" (Admin) em `src/routes/_app/team.tsx`: nome, email, função.
- Server fn `createTeamUser` (`supabaseAdmin.auth.admin.createUser` com senha aleatória autoconfirmada + `admin.generateLink({ type: 'recovery' })`).
- Salva `password_setup_link` em `profiles`; botão "Copiar link" e "Gerar novo link" no card (Admin).

## 4. Portal do Cliente

- `src/routes/portal/index.tsx`: converter em **dashboard** com KPIs (projetos totais, em atendimento, aprovados no mês, pendentes) filtrados por `client_id`.
- `src/routes/portal/estrategia.tsx`: mantém read-only para cliente. Botão discreto **"Solicitar alteração"** abrindo `https://wa.me/<num>?text=...` usando WhatsApp de `app_branding`. Admin (impersonado) vê link para edição em `/clientes-area`.

## 5. Admin visualiza portais

- Botão "Abrir portal" por cliente em `src/routes/_app/clientes-area.tsx`.
- Nova rota `src/routes/portal.$clientId.tsx` (gate `isMaster || isManager`) reaproveitando layout com `clientId` da URL.

## 6. Contato da empresa (Cadastros)

- Nova aba "Contato" em `src/routes/_app/cadastros.tsx`: WhatsApp, email, telefone — persistidos em `app_branding` (colunas novas). Expostos via `useBranding()`.

## 7. Registro automático de permissões

- `src/lib/access-registry.ts`: adicionar `portal_dashboard`, `portal_estrategia`, `contato_empresa`, `aprovacoes`.
- Seed idempotente em migration para inserir `role_permissions` correspondentes.
- Convenção documentada: todo novo menu/submenu → entrada em `access-registry.ts` + seed permission na mesma mudança.

---

## Migrations (SQL)

```sql
-- pending_registrations
CREATE TABLE public.pending_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('cliente','usuario')),
  full_name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  company_name text,
  phone text,
  requested_role app_role,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_reason text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.pending_registrations TO authenticated;
GRANT INSERT ON public.pending_registrations TO anon, authenticated;
GRANT ALL ON public.pending_registrations TO service_role;
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit" ON public.pending_registrations FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending');
CREATE POLICY "Managers view" ON public.pending_registrations FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY "Managers update" ON public.pending_registrations FOR UPDATE TO authenticated USING (public.is_manager(auth.uid()));

-- profiles: link de senha
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_setup_link text,
  ADD COLUMN IF NOT EXISTS password_setup_expires_at timestamptz;

-- app_branding: contato
ALTER TABLE public.app_branding
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

-- role_permissions seed
INSERT INTO public.role_permissions (role, resource, action) VALUES
  ('cliente','portal_dashboard','view'),
  ('cliente','portal_estrategia','view'),
  ('admin','portal_dashboard','view'),('admin','contato_empresa','view'),('admin','contato_empresa','manage'),
  ('admin','aprovacoes','view'),('admin','aprovacoes','manage'),
  ('gerente','aprovacoes','view'),('gerente','aprovacoes','manage'),
  ('gerente','portal_dashboard','view')
ON CONFLICT DO NOTHING;
```

---

## Arquivos afetados

- `src/routes/login.tsx` (reescrever)
- `src/routes/cadastro.cliente.tsx`, `src/routes/cadastro.usuario.tsx` (novos)
- `src/lib/auth-public.functions.ts` (novo — `submitPublicRegistration`)
- `src/lib/approvals.functions.ts` (novo — `listPending`, `approveRegistration`, `rejectRegistration`)
- `src/routes/_app/aprovacoes.tsx` (novo)
- `src/routes/_app.tsx` (novo item de menu "Aprovações" com badge de contagem)
- `src/routes/_app/team.tsx` + `src/lib/team.functions.ts` (novo usuário + link)
- `src/routes/portal/index.tsx` (dashboard)
- `src/routes/portal/estrategia.tsx` (botão WhatsApp)
- `src/routes/portal.$clientId.tsx` (novo, impersonation admin)
- `src/routes/_app/clientes-area.tsx` (botão "Abrir portal")
- `src/routes/_app/cadastros.tsx` (aba Contato)
- `src/lib/branding-context.tsx`, `src/lib/branding.functions.ts` (novos campos)
- `src/lib/access-registry.ts` (novos resources)
- Nova migration em `supabase/migrations/`

---

## Considerações

- Senha do cadastro público é armazenada **hasheada** (bcrypt via server fn) até aprovação; ao aprovar, `supabaseAdmin.auth.admin.createUser` recebe a senha original — como só temos o hash, alternativa: **guardar a senha criptografada com AES usando `SUPABASE_SERVICE_ROLE_KEY` como chave** ou pedir que o usuário defina senha só após aprovação (via link enviado). **Recomendação final**: não pedir senha no cadastro público — apenas dados de contato. Ao aprovar, cria auth user e gera link de definição de senha (mesmo fluxo do item 3). Confirme se prefere essa abordagem.
- Badge de "Aprovações pendentes" no menu principal atualiza a cada ~30s via query.
- Bloqueio de login para conta pendente: checar se email existe em `pending_registrations` com `status='pending'` (nenhum auth user existe ainda), então erro de credenciais será natural.