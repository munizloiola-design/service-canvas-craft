## Problema

O arquivo `src/routes/_app/clientes.tsx` define a rota `/clientes` e, por convenção do TanStack Router, vira **rota pai** de `clientes.crm.tsx` (`/clientes/crm`). Como o componente `ClientesPage` não renderiza `<Outlet />`, ao acessar `/clientes/crm` o router monta o pai (a tela de Clientes com abas) mas nunca monta o filho — por isso o clique no menu "CRM Prospecção" parece cair na página de Clientes.

## Correção

1. Renomear `src/routes/_app/clientes.tsx` → `src/routes/_app/clientes.index.tsx` e atualizar `createFileRoute("/_app/clientes")` para `createFileRoute("/_app/clientes/")`. Assim `/clientes` continua sendo uma folha independente, sem se tornar layout de `clientes.crm`.
2. Manter o export `CrmTab` (usado por `clientes.crm.tsx`) intacto no arquivo renomeado.
3. Deixar o Vite regenerar `routeTree.gen.ts` automaticamente.

Nenhuma outra rota ou lógica muda.