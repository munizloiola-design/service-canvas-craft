# Reestruturação: Áreas, Especialidades e Acessos Dinâmicos

## 1. Separação de portais (login)

Hoje `_app.tsx` já redireciona `isClient` para `/portal/calendario` e o portal `/portal/*` existe. Vou reforçar:
- Bloquear qualquer rota `_app/*` para quem tem role `cliente` (redirect para `/portal`).
- Bloquear `/portal/*` para quem NÃO é cliente (redirect para `/dashboard`).
- Landing `/` roteia por role após login.

Resultado: cliente nunca vê Kanban/Financeiro; agência (membro/gerente/admin) nunca cai no portal.

## 2. Nova hierarquia no banco (migration)

Hoje temos `project_roles` (funções) sincronizadas 1:1 com `collaborator_functions` via trigger, e `user_functions` + `function_field_visibility`. Vou introduzir dois níveis reais:

- `provider_areas` — Áreas (Arte, Audiovisual, Administrativo, …). Colunas: `id`, `name`, `sort_order`.
- `provider_specialties` — Especialidades. Colunas: `id`, `area_id` (FK → areas, ON DELETE RESTRICT), `name`, `sort_order`.
- `user_specialties` — M:N usuário↔especialidade. Colunas: `user_id` (FK auth.users), `specialty_id`, PK composta.
- `area_menu_visibility` — Colunas: `area_id`, `menu_key` (texto = chave do menu/recurso), PK composta. Presença = visível.
- `specialty_field_visibility` — Colunas: `specialty_id`, `field_key`, `can_view` bool, `can_edit` bool. PK composta.

Todas com RLS: leitura para `authenticated`; escrita apenas para `is_master`/`is_manager`. GRANTs explícitos para `authenticated` e `service_role`. Sem grant a `anon`.

**Migração de dados**: seed com uma Área "Geral" contendo todas as `collaborator_functions` atuais como especialidades; migrar `user_functions` → `user_specialties` e `function_field_visibility` → `specialty_field_visibility` (can_view=visible, can_edit=visible). Trigger antigo de sync entre `project_roles`↔`collaborator_functions` é removido — as duas passam a ser conceitos distintos (project_roles continua sendo "função no projeto"; especialidades são o cargo do usuário).

## 3. Aplicação das permissões dinâmicas

- **Menus**: `_app.tsx` já lê `navGroups` com `resource`. Vou adicionar uma camada que, para usuários não-admin, filtra também por `area_menu_visibility` — o menu só aparece se pelo menos uma das áreas do usuário (via suas especialidades) autoriza aquele `menu_key`. Admin/master continuam vendo tudo.
- **Campos**: `src/lib/field-visibility.tsx` passa a agregar `specialty_field_visibility` de todas as especialidades do usuário (união do `can_view`, união do `can_edit`). Exponho `canViewField(key)` e `canEditField(key)` — o form de demanda em `projects.tsx` usa esses hooks para mostrar/ocultar e desabilitar campos (Título, Descrição, Direção de arte, Referência, Legenda, Arquivo/Link finalizado, Custo, Cards de descrição, etc.).

## 4. Tela "Gestão de Perfis e Acessos" (só admin)

Nova aba em Configurações, rota `/_app/acessos.tsx`, item de menu "Perfis e Acessos", `masterOnly`. Layout em duas colunas:

```text
┌── Áreas ──────────────┐  ┌── Especialidades da área selecionada ──┐
│ + Nova área           │  │ + Nova especialidade                    │
│ • Arte           [⚙️] │  │ • Designer               [⚙️] [🗑]      │
│ • Audiovisual    [⚙️] │  │ • Motion                 [⚙️] [🗑]      │
│ • Administrativo [⚙️] │  │                                          │
└───────────────────────┘  └──────────────────────────────────────────┘
```

- CRUD inline (criar, renomear, excluir com confirmação; excluir área bloqueia se houver especialidades).
- Botão ⚙️ na Área → modal com checkboxes de todos os `menu_key` do sistema (lista central em `src/lib/menu-registry.ts`) marcando/desmarcando `area_menu_visibility`.
- Botão ⚙️ na Especialidade → modal com tabela `field_key × [Ver | Editar]` de todos os campos da demanda (lista central em `src/lib/field-registry.ts`) escrevendo em `specialty_field_visibility`.
- Aba adicional "Atribuição": tabela de usuários da equipe com multi-select de especialidades (grava em `user_specialties`).

A antiga tela `/permissoes` (função → visibilidade de campos) é substituída por esta; a de roles do banco (`role_permissions`) continua existindo separadamente.

## 5. Types e limpeza

- Após migration aprovada, `src/integrations/supabase/types.ts` é regenerado.
- Remover trigger `sync_project_role_to_function` e usos redundantes de `collaborator_functions`/`user_functions`/`function_field_visibility` depois que o novo fluxo estiver ativo (uma migration posterior faz o drop; não removo já para manter compatibilidade durante a transição).

## Detalhes técnicos

- Chaves de menu/campos ficam em arquivos-registro TS para autocompletar e evitar strings soltas.
- Filtro de menu roda no cliente após carregar `provider_areas`/`user_specialties` (uma query única com joins). Cacheado em contexto `AccessProvider`.
- `field-visibility.tsx` mantém a mesma API pública (`canView`, `canEdit`) para não quebrar telas existentes; troca só a fonte dos dados.
- Admin/master fazem bypass em todas as checagens (como já ocorre em `permissions.tsx`).
- Portal do cliente não consulta essas tabelas — usa apenas `client_users` + policies existentes.

## Perguntas antes de implementar

1. Confirma que **`project_roles`** (função exibida no card do projeto, ex.: "Designer responsável") deve continuar como lista independente, ou você quer que ela também passe a ser as Especialidades?
2. Ao migrar os dados atuais, tudo entra na Área "Geral" e você reorganiza depois na nova tela — ok?
