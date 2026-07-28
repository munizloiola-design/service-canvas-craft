
## Objetivo

1. Descobrir por que menus somem para alguns usuários.
2. Consolidar toda a configuração de acesso em **Perfis e Acessos** (`/acessos`) e eliminar a tela antiga **`/permissoes`**.

## Diagnóstico dos menus sumindo

Um item do menu lateral só aparece se **três** filtros passarem (`src/routes/_app.tsx` linhas 112–114):

```text
masterOnly? → precisa ser admin
can(resource, "view") → precisa existir linha em role_permissions
menuAllowed(to)       → área do usuário precisa liberar aquele menu
```

Ou seja, hoje o acesso é decidido por **duas fontes ao mesmo tempo**:

- `role_permissions` (papel × recurso × ação) — editada pela tela antiga `/permissoes`.
- `area_menu_visibility` (área do usuário × menu) — editada em `/acessos`.

Se em `/acessos` você marcar um menu para a Área do usuário, mas o **papel** dele (ex.: `membro`) não tiver a linha `view` correspondente em `role_permissions`, o menu **continua oculto** — e a tela onde isso se ajusta está fora do menu (`/permissoes`), o que gera a sensação de "não consigo acesso".

## Plano

### 1. Unificar a configuração em `/acessos`

Adicionar uma nova aba **"Permissões por papel"** em `src/routes/_app/acessos.tsx`, que substitui a `/permissoes` antiga:

- Matriz Papel (Admin / Gerente / Colaborador) × Recurso × Ação (Ver / Criar / Editar / Excluir), lendo e gravando em `role_permissions`.
- Após qualquer toggle, chamar `usePermissions().refresh()` para o menu atualizar sem F5.
- Fonte única de recursos: usar `MENU_REGISTRY` de `src/lib/access-registry.ts` (já existe) para manter os nomes idênticos aos menus reais e evitar recursos "fantasmas".

Estrutura final da tela `/acessos` (3 abas):
- Áreas & Especialidades (existente)
- Atribuição de usuários (existente)
- **Permissões por papel** (nova, migrada de `/permissoes`)

### 2. Remover a tela antiga

- Excluir `src/routes/_app/permissoes.tsx` (não está no menu, mas ainda é acessível pela URL).
- Rodar o gerador de rotas para atualizar `src/routeTree.gen.ts` (automático no dev-server).

### 3. Corrigir o caso do usuário atual sem menu

Depois que a nova aba estiver disponível, o próprio admin usa a matriz para dar `view` ao papel afetado nos recursos desejados. Nenhuma migração de dados é necessária — `role_permissions` já existe e tem dados para `admin` e `gerente`; provavelmente falta cobertura para `membro`.

### Fora do escopo (mantém como está)

- **Equipe** continua sendo onde se define o papel (admin/gerente/colaborador) e as funções do usuário.
- **Times** continua só organizando usuários em times de cliente.
- Regra de visibilidade por **especialidade** (menus/campos por área) permanece em `/acessos` como hoje.

## Detalhes técnicos

- Arquivos alterados: `src/routes/_app/acessos.tsx` (nova aba + hooks de `role_permissions`), `src/routes/_app/permissoes.tsx` (deletar).
- Sem migração SQL — reaproveita `role_permissions` existente e as RLS já configuradas.
- Sem mudanças em `src/routes/_app.tsx`: a lógica de filtragem do menu não muda, apenas passa a ser toda editada em um só lugar.
