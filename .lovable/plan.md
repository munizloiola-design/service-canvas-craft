## Corrigir crash "Cannot read properties of undefined (reading 'className')" em /clientes e /clientes/crm

### Causa raiz (confirmada)
A tabela `clients` **não tem** coluna `team_id` nem FK para `teams`. O código em `src/routes/_app/clientes.tsx` faz `select("*, teams(name)")`, e o PostgREST responde 400:
`PGRST200: Could not find a relationship between 'clients' and 'teams'`.

`useClients` lança o erro, o `errorComponent` do root sobe a tela "Algo deu errado". A mensagem `.className` vem da ramificação onde react-query re-executa e a linha `STATUS_META[r.status].className` também explode se `r` vier como stub durante o unmount da árvore em erro.

O schema real de agrupamento por cliente é a tabela **`client_teams`** (id, client_id, name, is_default, ...), não uma FK direta em `clients`.

### Correções em `src/routes/_app/clientes.tsx`

1. **Remover a join inválida em `useClients`**
   - `select("*, teams(name)")` → `select("*")`.
   - Ajustar `type Client`: remover `team_id?` e `teams?: { name: string } | null`.

2. **Substituir "Time padrão" pelo time default de `client_teams`**
   - Criar hook `useDefaultClientTeams()` que faz `supabase.from("client_teams").select("client_id, name").eq("is_default", true)` e devolve um `Map<clientId, name>`.
   - Na tabela do Diretório, `<TableCell>` de "Time padrão" lê do map em vez de `r.teams?.name`.

3. **Ajustar o formulário Novo/Editar cliente**
   - Remover o `<Select>` "Time responsável" e o estado `teamId` (schema não suporta).
   - Remover `team_id` do payload em `save.mutate` e do `openEdit`.
   - Remover o hook `useTeams()` (não é mais usado aqui).

4. **Guarda defensiva no badge de status** (linha 226)
   - `const meta = STATUS_META[r.status] ?? STATUS_META.inativo;` e usar `meta.label` / `meta.className`. Evita crash se algum registro vier com status desconhecido no futuro.

### Escopo
Somente `src/routes/_app/clientes.tsx`. `/clientes/crm` volta a funcionar automaticamente porque reusa `useClients`. Nenhuma migração de banco.
