## Situação atual (verificada)

Reli `src/routes/_app/acessos.tsx` e `src/routes/_app/permissoes.tsx` e consultei o banco. A tela `acessos.tsx` já está majoritariamente alinhada à nova hierarquia:

- Lê `provider_areas` e `provider_specialties` via TanStack Query.
- Cria subfunção enviando `area_id` para `provider_specialties`.
- Grava vínculo em `user_specialties` (`user_id`, `specialty_id`).
- Mutations já têm `onError` com `console.error` + `toast.error(describeSupabaseError(...))`.

Ainda assim há pontos que causam "quebras silenciosas" e itens do pedido que faltam. Não confirmei qual erro exato aparece hoje (não há logs) — a 1ª etapa do plano é reproduzir e capturar o erro antes de mexer.

## O que fazer

### 1. Reproduzir e diagnosticar (antes de refatorar)
- Abrir `/acessos`, capturar console + network e identificar a query/mutation que quebra. Provável suspeito: aba "Atribuição de usuários" carrega `internal_profiles` (view) — se a view tiver mudado de schema, o `select("id, full_name")` falha em silêncio.

### 2. Ajustes em `src/routes/_app/acessos.tsx`
- **Dropdown agrupado por Área**: hoje a "Atribuição" usa checkboxes livres. Trocar por um `Select` agrupado por Área (usando `SelectGroup`/`SelectLabel`) listando as `provider_specialties`, mantendo os badges das já atribuídas e um botão "Remover" por badge. Mantém a semântica multi-select, mas com UX de "escolher cargo" pedida.
- **Fallback de membros**: se `internal_profiles` falhar, cair para `profiles` filtrando por `has_role != 'cliente'` e logar o motivo.
- **Toaster de erro nas queries**: já existe via `useEffect`; garantir que também dispare quando `data` volta vazio por permissão (checar `error?.code === '42501'`).
- **Empty states amigáveis** quando não há áreas ou não há especialidades na área ativa (já existe texto simples — trocar por card com CTA "Criar primeira área/subfunção").

### 3. Ajustes em `src/routes/_app/permissoes.tsx`
- Envolver as duas mutations (`toggle`, `toggleVisibility`) com `console.error` + `describeSupabaseError` (hoje só mostram `e.message` cru).
- Trocar a fonte da aba "Visibilidade por função" de `collaborator_functions` para `provider_specialties` agrupadas por `provider_areas`, gravando em `specialty_field_visibility` — assim as duas telas passam a operar sobre a mesma hierarquia nova (hoje `permissoes.tsx` ainda usa a tabela legada `collaborator_functions` + `function_field_visibility`).

### 4. Sem migrações de banco
Nenhuma alteração de schema/RLS é necessária — as tabelas e políticas já existem e estão corretas para os fluxos acima.

## Detalhes técnicos

- `Select` agrupado: `Select` do shadcn com `SelectGroup` + `SelectLabel` por área; opções = specialties dessa área.
- Grid da aba assign continua rederizando um card por usuário (`internal_profiles`), mas o input principal vira o Select; checkbox grid fica como fallback avançado num `<details>` "Ver todas as especialidades".
- Todos os `mutation.onError` seguem o padrão: `console.error("[acessos:<ctx>]", e); toast.error(describeSupabaseError(e));`.
- Nenhum arquivo novo; apenas edições em `acessos.tsx` e `permissoes.tsx`.

## Fora de escopo
- Alterações em `access-registry.ts`, `field-visibility.ts` ou nas RLS.
- Remover a tabela legada `collaborator_functions` (usada por outras telas de cadastro).
