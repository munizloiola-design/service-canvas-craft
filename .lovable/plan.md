## O que será feito

### 1) Tabela de demandas (Projetos → visão Lista)
Em `src/routes/_app/projects.tsx`, na coluna de ações da linha (hoje só tem o ícone 👁 Ver), adicionar:
- **Editar** (ícone lápis) — abre o mesmo diálogo `NewDemandDialog` já existente com `editingProject` preenchido.
- **Excluir** (ícone lixeira, cor destrutiva) — pede confirmação e chama `supabase.from("projects").delete().eq("id", p.id)`, depois invalida a query `["projects"]` para reordenar automaticamente.

Ações ficam visíveis apenas para `isManager` (mesmo critério dos botões já existentes no drawer de detalhe).

### 2) Equipe — botões Excluir / Bloquear / Alterar
Em `src/routes/_app/team.tsx`, cada card de membro já tem **Alterar** (lápis) e **Excluir** (lixeira). Adicionar um terceiro botão **Bloquear / Desbloquear** (ícone cadeado) ao lado dos outros, visível para `isMaster`.

Como não existe coluna de bloqueio hoje, usar o recurso nativo de ban do Supabase Auth (`auth.admin.updateUserById({ ban_duration })`):
- Nova server function `setUserBanned` em `src/lib/team.functions.ts` protegida por `requireSupabaseAuth`, valida que o ator é admin, e chama `supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: banned ? "876000h" : "none" })`. Bloqueia auto-bloqueio.
- Para saber se um membro está bloqueado, incluir `banned_until` na listagem já feita pelo servidor (a página hoje lê `profiles` direto no cliente; adicionar um `useQuery` que chama uma nova server fn `listBannedUserIds` retornando o conjunto de IDs banidos, para renderizar o estado do botão e um badge "Bloqueado").

### 3) Detalhes técnicos
- Nenhuma alteração de schema; usamos o campo `banned_until` do `auth.users` gerenciado pelo Supabase.
- Reaproveita `deleteTeamMember` já existente para exclusão.
- Toasts de sucesso/erro com `sonner`, invalidando as queries relevantes para reordenar automaticamente.

### Arquivos alterados
- `src/routes/_app/projects.tsx` — botões Editar/Excluir na linha da tabela.
- `src/routes/_app/team.tsx` — botão Bloquear/Desbloquear + badge de estado.
- `src/lib/team.functions.ts` — `setUserBanned` e `listBannedUserIds`.
