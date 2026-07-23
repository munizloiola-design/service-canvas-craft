## Objetivo

Refatorar a área de gestão de clientes em uma página CRM centralizada em `/clientes`, com 4 abas e layout SaaS clean.

## Mudanças

### 1. Menu lateral (`src/routes/_app.tsx`)

- Renomear entrada "Área do Cliente" → **"Clientes"** apontando para `/clientes` (ícone `Building2` já em uso).

### 2. Nova rota `/clientes` (`src/routes/_app/clientes.tsx`)

Criar novo arquivo (substituindo `clientes-area.tsx`, que será removido) com layout limpo — container mais largo (`max-w-7xl`), cards em `bg-card/95` translúcido, espaçamento generoso e 4 abas via shadcn `Tabs`:

**Aba 1 — Diretório (default)**

- Migrar CRUD atual de `clients`.
- Tabela moderna (shadcn `Table`) com colunas: Nome, Contato, Telefone, E-mail, Time Responsável, Ações (editar/excluir).
- Busca por nome/e-mail no topo, botão "Novo cliente".

**Aba 2 — Acessos do Portal**

- Migrar painel existente de `client_users` (`inviteClientUser` / `listClientAccess` / `removeClientAccess`).
- Formulário para criar login (e-mail + senha) vinculando a um cliente do diretório.
- Lista dos vínculos ativos com opção de remover.

**Aba 3 — Briefing & Estratégia**

- Seletor de cliente no topo; formulário rico salvo em `client_briefings` via TanStack Query (`useMutation` + `invalidateQueries`).
- Reaproveitar campos existentes (público, persona, SWOT, referências, concorrência, canais, arquétipo, missão/visão/valores, redes sociais).
- **Adicionar campo novo `tom_de_voz**` (nova coluna `text` em `client_briefings` via migration) e um bloco "Links importantes" (Drive de fotos, logotipo, materiais) — usar o campo `materiais` já existente como "Links importantes / Drive" e o novo `tom_de_voz`.
- Autosave manual via botão "Salvar alterações" com toast.

**Aba 4 — Projetos Ativos (nova, somente leitura)**

- Seletor de cliente (compartilhado com a aba 3 via state local).
- Query em `projects` filtrando `client_id`, exibindo em lista: título, status (badge colorido a partir de `workflow_statuses`), responsável, `due_date`.
- Estado vazio com CTA para ir até `/projects`.

### 3. Migration Supabase

- `ALTER TABLE public.client_briefings ADD COLUMN IF NOT EXISTS tom_de_voz text;`

### 4. Limpeza

- Remover `src/routes/_app/clientes-area.tsx` e qualquer link remanescente para `/clientes-area`.
- Ajustar `resource` de permissão para reutilizar `clientes_area` (mantém regras existentes de Admin/Gerente/Atendimento).

## Detalhes técnicos

- Tudo com TanStack Query (`useQuery`/`useMutation`), tratamento de erros via `describeSupabaseError`.
- Sem alterações em RLS além da nova coluna.
- Ícones Lucide: `Building2` (menu), `Users`, `KeyRound`, `FileText`, `FolderKanban` nos triggers das abas.

Adicione no cadastro a categoria cliente ativo, inativo e prospecção e crie uma área de CRM para trabalharmos os cliente em prospecção