## Objetivo
1. Colocar "Esqueci minha senha" no `/login`.
2. Quando o admin envia acesso ao portal, o cliente recebe um e-mail que abre uma tela para ele criar a própria senha.

## Situação atual (verificada)
- `/login` já existe (`src/routes/login.tsx`) e faz `signInWithPassword`. Sem link de recuperação.
- Convite do cliente usa `inviteClientUser` (`src/lib/client-access.functions.ts`) chamando `supabaseAdmin.auth.admin.inviteUserByEmail(email)` — hoje sem `redirectTo`, então o link do e-mail cai na Site URL padrão do Supabase, sem página dedicada de criar senha.

## Mudanças

### 1. Nova rota pública `/set-password` (`src/routes/set-password.tsx`)
- Página pública (fora de `_authenticated`).
- Lê o hash da URL (`#access_token=...&type=invite|recovery`) — o Supabase Auth já hidrata a sessão automaticamente via `detectSessionInUrl` no cliente. Confirma com `supabase.auth.getSession()` num `useEffect`.
- Se não houver sessão de recuperação/convite, mostra mensagem "Link inválido ou expirado" com botão para voltar ao login.
- Formulário: nova senha + confirmação (min. 8 caracteres, iguais). Envia `supabase.auth.updateUser({ password })`.
- Ao sucesso: `toast.success` e redireciona — clientes (têm role `cliente`) vão para `/portal`; demais para `/dashboard`. Usa `supabase.auth.getUser()` + consulta a `user_roles` para decidir.
- Trata erros com `describeSupabaseError` + `console.error`.

### 2. Link "Esqueci minha senha" no `/login`
- Abaixo do campo de senha, botão "Esqueci minha senha" abre um `Dialog` com input de e-mail.
- Chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/set-password` })`.
- Mostra toast "Se o e-mail existir, enviaremos as instruções" (sem vazar existência de conta) e fecha o dialog.

### 3. Ajuste no convite do cliente (`src/lib/client-access.functions.ts`)
- Acrescentar campo opcional `redirect_to: string().url()` no schema.
- Passar `{ redirectTo: data.redirect_to }` para `inviteUserByEmail` quando presente.
- No chamador (`src/routes/_app/clientes.tsx`), enviar `redirect_to: `${window.location.origin}/set-password``. Assim o link do convite abre direto a tela de criar senha.

### 4. E-mails de auth
- Se o projeto já tem templates de auth Lovable ativos, os assuntos "Convite" e "Recuperação de senha" continuam funcionando — o link dentro deles aponta para `redirectTo`. Nenhuma alteração de template necessária.
- Não vou habilitar templates customizados agora — só se o usuário pedir.

## Detalhes técnicos
- Sessão do link vem no fragmento (`#`); TanStack Start é SSR mas o hash não é enviado ao servidor, então o handling é 100% client (`useEffect`).
- `resetPasswordForEmail` sempre retorna sucesso (não confirma existência) — bom para segurança.
- Cliente sem role `cliente` ainda pode chegar em `/set-password` (fluxo de recuperação normal); redirect final decide pelo tipo de usuário.

## Fora de escopo
- Alterar Site URL/Redirect URLs no Supabase (assumo que `window.location.origin` já está permitido; se falhar, aviso o usuário para adicionar a URL na lista de Redirect URLs do projeto).
- Custom auth email templates.
- Migrações de banco.
