## Situação atual (verificada)

**1. Menus faltando no controle de acesso**
A lista da sidebar (`src/routes/_app.tsx`) tem 5 itens que **não existem** no registro usado pela tela Perfis e Acessos (`src/lib/access-registry.ts`). Como o menu só aparece se `menuAllowed(item.to)` for verdadeiro, esses itens hoje são invisíveis para todos, sem opção de liberar:

- `/clientes/crm` — CRM Prospecção
- `/parceiros` — Parceiros
- `/squad` — Times
- `/squad/relatorio` — Relatório do Squad
- `/acessos` — Perfis e Acessos

Também os agrupamentos do registro estão desatualizados em relação à sidebar (Clientes e Squad viraram grupos próprios).

**2. Dashboard**
`src/routes/_app/dashboard.tsx` tem 9 widgets no catálogo (`WIDGETS`) e nenhum deles respeita permissão: qualquer usuário pode adicionar "Fluxo de caixa", "Receitas recorrentes", "Depreciação de equipamentos" etc., mesmo sem acesso a Financeiro ou Equipamentos. Os dados em si continuam protegidos por RLS, mas o widget aparece vazio/quebrado e expõe informação que não deveria estar disponível.

## O que será feito

### Parte 1 — Registro de menus completo
- Adicionar as 5 chaves faltantes ao `MENU_REGISTRY`, com os grupos alinhados à sidebar: Operação, Cliente, Financeiro, Marketing, Squad, Configurações.
- Revisar item a item para garantir paridade 1:1 entre sidebar e registro (nenhum menu sem chave, nenhuma chave órfã).
- Na tela **Perfis e Acessos → Menus visíveis**, os novos itens passam a aparecer para liberação por área.
- Liberar os novos menus para a área "Administração" (que hoje concentra Admins/Masters) para não haver perda de acesso após a mudança.

### Parte 2 — Dashboard por permissão
- Mapear cada widget para a chave de menu correspondente:

```text
stats_overview          -> sempre (dashboard)
projects_by_status      -> /projects
status_timer            -> /tempo
upcoming_deadlines      -> /projects
recent_projects         -> /projects
cash_flow               -> /financeiro
recurring_revenue       -> /financeiro
team_load               -> /team
equipment_depreciated   -> /equipamentos
```

- Filtrar o diálogo "Adicionar widget" para mostrar apenas widgets permitidos.
- Não renderizar widgets já salvos que o usuário perdeu permissão (ocultar, sem apagar do banco).
- Filtrar `DEFAULT_WIDGETS` na primeira carga, para o usuário só receber widgets a que tem direito.

### Parte 3 — Novos widgets sugeridos
Adicionar ao catálogo, cada um também vinculado a uma permissão:

- **Tickets pendentes** (`/tickets`) — solicitações aguardando triagem.
- **Aprovações pendentes do cliente** (`/aprovacoes`) — demandas em validação sem decisão.
- **Funil de prospecção** (`/clientes/crm`) — valor e quantidade por estágio do CRM.
- **Autorizações financeiras pendentes** (`/financeiro`) — solicitações públicas de lançamento aguardando revisão.
- **Minhas demandas** (sempre) — projetos onde o usuário logado é responsável.

## Detalhes técnicos
- Alterações em `src/lib/access-registry.ts` (chaves + grupos) e `src/routes/_app/dashboard.tsx` (catálogo com campo `menu`, filtragem via `useAccess().menuAllowed`, novos componentes de widget).
- Uma migração pequena inserindo linhas em `area_menu_visibility` para a área de Administração com as novas chaves.
- Sem mudança de RLS: os widgets novos usam tabelas já existentes (`ticket_requests`, `projects`, `crm_stages`/`clients`, `financial_entry_requests`).
