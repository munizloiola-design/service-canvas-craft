# Separação de usuários cliente

Hoje o papel `cliente` já existe (`app_role`) e o vínculo com clientes é feito em `client_users`, mas as telas internas (Equipe, Perfis e Acessos, Relatório de Squad, seletores de responsáveis) listam todos os `profiles` juntos, misturando clientes com colaboradores da agência. O objetivo é isolar quem é cliente da área interna e sinalizar visualmente.

## Regras

- **Cliente** = usuário que possui role `cliente` **ou** está em `client_users`.
- Clientes só aparecem em telas do portal (`/portal/*`) e na aba "Acesso ao portal" de `clientes-area`.
- Clientes não aparecem em: Equipe, Perfis e Acessos, Times/Squad, Relatório de Squad, seletores de responsável/assignees em projetos, tickets e aprovações.
- Onde um cliente precisar aparecer (ex.: comentários, histórico), mostrar um badge "Cliente" ao lado do nome.
- Login: cliente entra pelo card "Cliente" e cai em `/portal`; se tentar `/`_app`/*` é redirecionado ao portal.

## Backend

1. Criar view/RPC `internal_profiles` (SECURITY DEFINER) que retorna `profiles` **excluindo** quem tem role `cliente` ou linha em `client_users`. Grant SELECT para `authenticated`.
2. Criar função `is_client_profile(_uid uuid) returns boolean` (já existe `is_client_user`; adicionar cobertura ao role `cliente`).
3. Ajustar RLS em `team_members`, `project_assignees` e `project_roles` para impedir inserir user com papel `cliente`.

## Frontend

1. **Hook novo** `useInternalProfiles()` em `src/lib/team.functions.ts` (ou util) que consome `internal_profiles`. Trocar todas as queries `from("profiles").select("id, full_name")` das telas internas por esse hook:
   - `src/routes/_app/team.tsx`
   - `src/routes/_app/acessos.tsx`
   - `src/routes/_app/squad.tsx`
   - `src/routes/_app/squad.relatorio.tsx`
   - `src/routes/_app/projects.tsx` (seletor de responsável/assignees)
   - `src/routes/_app/tickets.tsx`, `aprovacoes.tsx`, `calendario.tsx` (onde listar usuários internos)
2. **Badge "Cliente"**: componente `<ClientBadge />` reutilizável; renderizar em `clientes-area` (aba Acesso), em comentários/históricos que exibem nome de cliente, e no menu do portal ao lado do avatar.
3. **Roteamento**:
   - `src/routes/_app.tsx`: no `beforeLoad`/efeito de guarda, se `roles.includes("cliente")` **e** não tiver outro papel interno, `navigate({ to: "/portal" })`.
   - `src/routes/portal.tsx`: se usuário não for cliente e não tiver `client_users`, redirecionar para `/dashboard`.
4. **Cadastro/convite**: ao criar acesso pela aba "Acesso ao portal" (clientes-area), garantir que o novo usuário receba role `cliente` e entre em `client_users`, e NÃO seja adicionado a `team_members`.

## Áreas técnicas

- Migration: view `public.internal_profiles` + grants + policies de bloqueio em `team_members`/`project_assignees`.
- Ajuste do `useAuth` para expor helper `isClientOnly`.
- Não altera dados existentes; apenas filtra na leitura e bloqueia novas misturas.

## Fora de escopo

- Redesenho do portal do cliente.
- Migração de usuários já cadastrados incorretamente (será feito manualmente depois se necessário).
