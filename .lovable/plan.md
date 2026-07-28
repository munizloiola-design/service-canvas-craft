## Objetivo

Deixar o controle de acessos **exclusivamente em "Perfis e Acessos"** (áreas → menus, especialidades → campos, mais gestão de papéis/funções). Remover a camada paralela baseada em `role_permissions` (tabela + aba "Permissões por papel" + contexto `usePermissions`) que hoje concorre com essa tela.

## Como fica o modelo final

- **Admin / Admin master / Gerente**: acesso total (bypass), como já é hoje via `isPrivileged` em `AccessProvider`.
- **Demais usuários (membro, cliente-interno, fornecedor)**: acesso a menu e campos vem 100% de:
  - `provider_areas` + `area_menu_visibility` (quais menus a área enxerga)
  - `provider_specialties` + `specialty_field_visibility` (quais campos vê/edita)
  - `user_specialties` (o vínculo do usuário)
- Sem especialidade cadastrada = **sem menus** (hoje virava "libera tudo" por fallback em `role_permissions`). Admin precisa liberar explicitamente em Perfis e Acessos.

## Mudanças no frontend

1. `src/routes/_app.tsx`
   - Remover `usePermissions` / `can(item.resource, "view")` do filtro de menu.
   - Filtro fica: `masterOnly` + `menuAllowed(item.to)`.
   - Remover `permsLoading` do gate de loading.

2. `src/routes/_app/acessos.tsx`
   - Remover a aba **"Permissões por papel"** (TabsTrigger + TabsContent + componente `RolePermissionsMatrix` + constante `ROLE_RESOURCES`).
   - Manter apenas: Áreas, Especialidades, Menus por área, Campos por especialidade, Vínculo usuário↔especialidade e gestão de papéis do usuário (papel continua servindo para hierarquia — admin/gerente/membro/cliente — mas não decide mais menu/campo).

3. `src/routes/_app/personalizacao.tsx`
   - Trocar o gate `can("branding","manage")` por `isMaster` (via `useAuth()`), já que branding é decisão de administrador.

4. `src/routes/__root.tsx`
   - Remover `PermissionsProvider` (import + wrapper). `AccessProvider` continua.

5. `src/lib/permissions.tsx`
   - Excluir o arquivo.

## Mudanças no backend (migration)

- Dropar policies, tabela `public.role_permissions` e a função `public.has_permission(...)` (nada no backend depende dela hoje — confirmado por `rg has_permission`).
- Manter `user_roles`, `has_role`, `is_manager`, `is_master`, `role_rank` (usados por RLS de projetos, financeiro, etc.). Papel continua existindo para hierarquia e RLS; só a matriz de "papel × recurso × ação" some.

## Impacto para usuários existentes

- Usuários sem especialidade que hoje viam tudo pelo fallback vão parar de ver menus até serem vinculados a uma área/especialidade em Perfis e Acessos. Isso é o comportamento pedido ("desativar completamente a lógica remanescente"). Admin/gerente/master seguem com acesso total automaticamente.

## Arquivos tocados

- Editar: `src/routes/__root.tsx`, `src/routes/_app.tsx`, `src/routes/_app/acessos.tsx`, `src/routes/_app/personalizacao.tsx`
- Excluir: `src/lib/permissions.tsx`
- Migration: drop `role_permissions` + `has_permission`
