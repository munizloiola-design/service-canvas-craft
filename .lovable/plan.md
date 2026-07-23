## Objetivo
Reorganizar a navegação criando o grupo **Squad** no menu com três itens (Perfis e Acesso, Equipe, Squad), remover itens redundantes de Cadastros/Configurações e verificar erros.

## 1. Novo grupo de menu "Squad" (`src/routes/_app.tsx`)

Adicionar um novo `NavGroup` com label **"Squad"** contendo:
- **Equipe** → `/team` (rota já existente, `resource: "team"`) — atual item avulso será movido para dentro deste grupo.
- **Perfis e Acessos** → `/acessos` (rota já existente, `masterOnly`) — movida do grupo Configurações.
- **Squad** → `/squad` (rota nova) — CRUD de equipes por cliente, migrado da aba "Equipes" de `/clientes-area`.

Remover:
- Item avulso "Equipe" atual (linha 48).
- "Perfis e Acessos" do grupo Configurações (linha 55).
- "Permissões" do grupo Configurações (linha 56) — a página `/permissoes` continua existindo, apenas sai do menu.

## 2. Nova rota `/squad`

Criar `src/routes/_app/squad.tsx`:
- Reaproveita o componente `TeamsPanel` que hoje vive dentro de `src/routes/_app/clientes-area.tsx` (aba "equipes").
- Mesma UX: seletor de cliente → CRUD de equipes daquele cliente → membros + marcação de equipe padrão.
- `resource: "clientes_area"` (mesma permissão já usada pelo painel), gate `isManager`.

## 3. Ajustes em rotas existentes

- **`src/routes/_app/clientes-area.tsx`**: remover a aba "Equipes" (`TabsTrigger` + `TabsContent`) e extrair o componente `TeamsPanel` para um módulo compartilhado (`src/components/squad/TeamsPanel.tsx`) importado por `/squad`. A automação de auto-preenchimento em `projects.tsx` não muda (continua lendo `client_teams`/`client_team_members`).
- **`src/routes/_app/cadastros.tsx`**: remover as abas **"Funções"** (`project_roles`) e **"Subfunções (visibilidade)"** (`collaborator_functions`) do array `TABLES` (linhas 49–65). A gestão dessas entidades passa a viver em **Perfis e Acessos** (`/acessos`), que já cobre áreas/especialidades dinâmicas.

## 4. Verificação de erros

Passadas rápidas para conferir:
- Nenhum `<Link to="/permissoes">` ou `to="/cadastros" tab=funcoes` quebrado após remover itens do menu (a rota `/permissoes` permanece acessível por URL direta para master).
- `TeamsPanel` extraído mantém imports de `supabase`, `useAuth`, `Checkbox`, `Star`, `Users`.
- Rodar após build: checar console/rede na preview para confirmar que `/squad` carrega e que o auto-preenchimento de equipe em nova demanda continua funcionando.

Correções sugeridas (aplicadas no mesmo passo se confirmadas na inspeção):
- Se `cadastros.tsx` referenciar `TABLES[0].key` como default e ele mudar, garantir que o estado inicial `useState(TABLES[0].key)` continue válido.
- Se algum componente ainda importar `TeamsPanel` de `clientes-area.tsx`, atualizar o import path.

## Detalhes técnicos
- Sem migração de banco: `client_teams`/`client_team_members` já existem.
- Ícone sugerido para "Squad": `Users2` (lucide) para diferenciar de "Equipe" (`Users`).
- Ordem dentro do grupo Squad: Equipe → Squad → Perfis e Acessos.
- `menuAllowed("/squad")` — adicionar chave no `access-registry.ts` se o filtro por área a exigir (verificar durante a implementação e cadastrar como visível por padrão para admins/gerentes).