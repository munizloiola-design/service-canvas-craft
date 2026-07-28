## Objetivo

Eliminar a duplicidade do controle de papéis/subfunções que hoje existe em duas telas (aba "Papel & Funções" dentro do dialog de membro em **Squad › Equipe** e a tela **Perfis e Acessos**). Deixar tudo centralizado em **Perfis e Acessos**, que já é a fonte oficial de acesso a menus e campos.

## Diagnóstico (confirmado por leitura de código)

- `src/routes/_app/team.tsx` — o dialog do membro tem uma aba **Papel & Funções** que grava em `user_roles` (admin/gerente/membro) e `user_functions` (subfunções antigas de `collaborator_functions`). Essa aba usa uma checagem de permissão própria (`canManageThisUser = isMaster || actorRank > targetRank`) que dispara os avisos "Você não tem permissão para alterar o papel deste membro" mesmo quando o usuário já é Admin em outra área.
- `src/routes/_app/acessos.tsx` — a fonte oficial: gerencia `provider_areas`, `provider_specialties`, `user_specialties` e a visibilidade de menus/campos (`area_menu_visibility`, `specialty_field_visibility`). É o que hoje efetivamente decide o que aparece no menu.
- Resultado: alterar cargo em Squad não muda o menu (que vem de Perfis e Acessos), e alterar em Perfis e Acessos não altera `user_roles`, deixando checagens antigas (`isAdmin`, `isManager`) inconsistentes.

## O que fazer

### 1. `src/routes/_app/team.tsx` — remover a aba duplicada

- Remover a `<TabsTrigger value="funcoes">` e o `<TabsContent value="funcoes">` do `MemberDialog`.
- Remover estados/mutations relacionados: `primaryRole`, `selectedFns`, escrita em `user_roles` e `user_functions` dentro de `saveProfile`.
- Trocar o botão "Salvar ficha e funções" por "Salvar ficha".
- Adicionar no cabeçalho do dialog um link/botão **"Gerenciar papel e cargos em Perfis e Acessos →"** que navega para `/acessos?tab=assign&user=<id>`.

### 2. `src/routes/_app/acessos.tsx` — passar a gerenciar também o Papel principal

- Ler `?tab=` e `?user=` da URL para abrir direto na aba **Atribuição de usuários** com o card do membro em destaque (scroll + highlight rápido).
- No card de cada membro do `AssignTab`, adicionar acima da lista de cargos um seletor **Papel principal** (`admin` / `gerente` / `membro`) que grava em `user_roles` usando a mesma regra atual do `MemberDialog` (só Master ou papel de rank estritamente maior pode alterar).
- Mostrar badge do papel atual ao lado do nome do membro.

### 3. Guarda de acesso da própria tela `/acessos`

- Hoje `AcessosPage` gateia por `isMaster || roles.includes("admin")`. Manter, mas também aceitar quem tem a especialidade **Administração › Total** (mesma regra já usada em outros pontos do sistema), para não bloquear Admins que só existem via Perfis e Acessos.

### 4. Limpeza

- Nenhuma migração de banco necessária: `user_roles` continua sendo a fonte de papel; `collaborator_functions`/`user_functions` continuam existindo para não quebrar telas que ainda leem (não vamos deletar dados nesta rodada).
- Remover imports não usados em `team.tsx` (Checkbox, ROLE_LABELS, ASSIGNABLE_ROLES etc.) que ficarem órfãos.

## Fora de escopo

- Migrar `user_functions` legados para `user_specialties` (pode ser um passo futuro).
- Alterar as políticas RLS de `user_roles`.

## Diagrama

```text
Antes:
  Squad › Equipe › [Membro] › aba "Papel & Funções"  ──► user_roles + user_functions
  Perfis e Acessos › Atribuição                      ──► user_specialties (menus/campos)

Depois:
  Squad › Equipe › [Membro] › Ficha + Anotações      (sem papéis)
                              └─► link "Gerenciar em Perfis e Acessos"
  Perfis e Acessos › Atribuição                      ──► user_roles (papel)
                                                     ──► user_specialties (menus/campos)
```
