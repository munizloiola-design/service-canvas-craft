## Módulo Banco de Contatos (Parceiros)

### 1. Banco de dados (migration)
- `contact_categories`: `id uuid pk`, `name text unique not null`, `created_at timestamptz`.
- `partner_contacts`: `id uuid pk`, `name text not null`, `profession text`, `phone text`, `email text`, `category_id uuid fk → contact_categories(id) on delete set null`, `notes text`, `created_at timestamptz`, `updated_at timestamptz` + trigger.
- GRANTs para `authenticated` e `service_role`. RLS habilitado.
- Políticas:
  - `contact_categories`: SELECT para qualquer usuário autenticado (agência); INSERT/UPDATE/DELETE apenas para `is_manager(auth.uid())` (admin/admin master/gerente).
  - `partner_contacts`: SELECT para autenticados não-cliente (`not is_client_user`); INSERT/UPDATE/DELETE para `is_manager` ou membro da agência (autenticado não-cliente). Confirmar preferência abaixo.

### 2. Rota e menu
- Nova rota `src/routes/_app/parceiros.tsx` (protegida pelo layout `_app`).
- Adicionar item **"Parceiros"** (`Handshake` ou `Contact` icon) na sidebar em `src/routes/_app.tsx`, visível a papéis internos (admin, gerente, membro) — oculto para cliente.

### 3. Tela `/parceiros`
Layout em uma página com TanStack Query + shadcn:
- **Header** com título e dois botões:
  - `Gerenciar categorias` (Dialog): lista com CRUD (input + botão Adicionar, editar/excluir inline). Somente admins/gerentes veem o botão.
  - `Novo contato` (Dialog): form com `name*`, `profession`, `phone`, `email`, `category_id` (Select), `notes` (Textarea). Reaproveitado para edição.
- **Barra de filtros** (sticky Card):
  - `Input` de busca por nome (debounce simples via state).
  - `Select` **Categoria** (lista de `contact_categories` + opção "Todas").
  - `Select` **Profissão** (distintas de `partner_contacts.profession` + "Todas").
- **Listagem em Grid de Cards** (responsivo: 1/2/3 colunas). Cada card:
  - Nome, badge da categoria, profissão, telefone (com `tel:`), email (com `mailto:`), notas truncadas.
  - Menu de ações (editar/excluir) para admins/gerentes.
- Estado vazio + skeleton loader.

### 4. Data layer
- Queries com `useQuery`:
  - `["contact_categories"]` → SELECT ordenado por nome.
  - `["partner_contacts", { search, categoryId, profession }]` → SELECT com joins para nome da categoria; filtragem via `.ilike` e `.eq` no Supabase.
- Mutations com `useMutation` + `invalidateQueries` e `toast` (sucesso/erro usando `describeSupabaseError`).
- Acesso direto via `@/integrations/supabase/client` (padrão já usado nas telas `_app/*`).

### Detalhes técnicos
- Ícone do menu: `Handshake` (lucide).
- Ordenação padrão: `name asc`.
- `profession` opcional, mas o filtro só lista valores não-nulos e distintos (derivado no client a partir do resultado).
- Excluir categoria mantém contatos (`on delete set null`) para não perder registros.

### Pergunta rápida
Quem pode **cadastrar/editar contatos**?
- (A) Somente admins/gerentes.
- (B) Qualquer usuário interno da agência (admin, gerente, membro) — clientes nunca.

Se não responder, sigo com **(B)** e restrinjo o gerenciamento de categorias a admins/gerentes.
