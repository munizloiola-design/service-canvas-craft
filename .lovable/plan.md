## Auditoria — situação atual

Verifiquei o que ainda decide acesso por papel (role) em vez de passar por **Perfis e Acessos** (áreas/especialidades):

**Sidebar (`src/routes/_app.tsx`)**
- `masterOnly: true` no item `/acessos` (linha 62) — ainda gate por papel.
- Redirect de cliente por papel (`isClient && !isMaster && !isManager`) — legítimo (separação portal × agência), mantém.

**Guards de rota por papel**
- `src/routes/_app/personalizacao.tsx`: `if (!isAdmin) return <Navigate to="/dashboard" />` (usa `roles` + `isMaster`).
- `src/routes/_app/team.tsx`: `if (!isManager) return ...`.
- `src/routes/_app/squad.index.tsx`: `if (!isManager) return ...`.

**Bypass silencioso no AccessProvider (`src/lib/access-context.tsx`)**
- `menuAllowed / canViewField / canEditField` retornam `true` se `isPrivileged` (admin/gerente/master) — bypass por papel.
- Também retornam `true` quando o usuário não tem especialidade cadastrada (linha 71/76/81) — abre tudo por padrão, contornando Perfis e Acessos.
- Comentário residual "cai no controle de role_permissions" (tabela já removida).

**UI condicional por papel (não é liberação de rota, é edição)**
- `projects.tsx`, `parceiros.tsx`, `team.tsx`, `ProjectChat.tsx` usam `isManager` para mostrar botões de gerenciar/excluir. **Fora do escopo desta tarefa** (é permissão de campo, não de rota); ficam como estão salvo pedido explícito.

**Backend/DB (mantém papel — necessário)**
- `user_roles` e RLS continuam existindo (segurança). Server functions (`team.functions.ts`, `approvals.functions.ts`, `branding.functions.ts`, `client-access.functions.ts`) checam admin/gerente para operações sensíveis — isso é correção de segurança, não é gate de menu, **mantém**.

---

## Plano de correção

Objetivo: **toda liberação de rota/menu passa por Perfis e Acessos** (chaves em `area_menu_visibility`). Papéis só sobrevivem onde são obrigatórios: separação portal cliente × agência, RLS/DB, e ações administrativas server-side.

### 1. `src/lib/access-context.tsx`
- Remover o bypass `isPrivileged` de `menuAllowed / canViewField / canEditField`.
- Remover o fallback "sem especialidade = tudo liberado". Sem entradas em `area_menu_visibility`, o item fica oculto.
- Manter `isPrivileged` exposto apenas informativamente (para UIs que ainda o usam em botões de gerência).

### 2. `src/routes/_app.tsx`
- Remover `masterOnly` do tipo `NavItem` e do item `/acessos`.
- Filtro do sidebar passa a ser só `menuAllowed(item.to)`.
- Mantém o redirect cliente → `/portal` (papel `cliente` define o portal, não a permissão).

### 3. Guards de rota — trocar papel por `menuAllowed`
- `personalizacao.tsx`: substituir `if (!isAdmin)` por `if (!menuAllowed("/personalizacao"))`.
- `team.tsx`: substituir `if (!isManager)` por `if (!menuAllowed("/team"))`.
- `squad.index.tsx`: substituir `if (!isManager)` por `if (!menuAllowed("/squad"))`.

### 4. Seed de compatibilidade (migração)
Para o admin/master atual não perder acesso ao remover o bypass, garantir que exista uma área "Administração" com todas as `menu_key`s cadastradas (uma para cada rota do sidebar) e vincular admins/masters via `user_specialties` a uma especialidade dessa área. Alternativa mais segura: um seed idempotente que atribui a admins/masters a especialidade "Administração-Total" com todas as `area_menu_visibility` preenchidas.

Sem esse seed, admins/masters ficariam sem menus assim que o bypass sair. A migração:
- Cria (idempotente) área `Administração` + especialidade `Total`.
- Popula `area_menu_visibility` com todas as chaves usadas no sidebar.
- Insere em `user_specialties` toda linha `user_roles` com `role in ('admin','admin_master')` que ainda não tenha essa especialidade.

### 5. Limpeza
- Remover comentário obsoleto sobre `role_permissions`.
- Manter `AppRole`, `useAuth`, `isMaster`, `isManager` — ainda usados para redirect de portal e para gates de escrita em componentes (fora do escopo).

### Detalhes técnicos

Chaves de menu esperadas em `area_menu_visibility` (uma linha por área × chave):
```text
/dashboard  /projects  /tickets  /calendario  /equipamentos  /tempo  /parceiros
/clientes   /clientes/crm
/financeiro /orcamento
/facebook   /diguinho
/team       /squad     /squad/relatorio  /aprovacoes  /acessos
/cadastros  /integracoes  /personalizacao
```

Após aplicar, qualquer novo usuário só verá itens explicitamente liberados em Perfis e Acessos; admins continuam vendo tudo por herdarem a especialidade "Total" — controlável pela mesma tela, sem código.
