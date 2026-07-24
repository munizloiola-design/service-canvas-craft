## Problema

Clientes que fazem login estão caindo em `/dashboard` (área da agência) em vez do portal do cliente. Causas:

1. `src/routes/index.tsx` redireciona todo usuário logado para `/dashboard`, sem checar se é cliente.
2. Em `src/routes/_app.tsx` a guarda `isClientOnly` só redireciona quando o usuário **não tem** nenhum outro papel — se o cliente tiver acidentalmente `membro` (ou o papel ainda não carregou) ele fica preso na área da agência.
3. Não existe uma tela inicial (dashboard) dentro do `/portal` — hoje `/portal` só redireciona para `/portal/calendario`.

## O que fazer

### 1. Roteamento correto por tipo de conta
- `src/routes/index.tsx`: usar `useAuth().isClient` e mandar cliente para `/portal`, agência para `/dashboard`.
- `src/routes/_app.tsx`: qualquer usuário com papel `cliente` vai para `/portal` (remover a exigência "somente cliente"). Clientes não devem ver o layout da agência mesmo que tenham outro papel residual.
- `src/routes/login.tsx`: já redireciona por `isClient`; manter, mas garantir que o destino seja `/portal` (que agora aponta para o novo dashboard).

### 2. Dashboard do cliente
- Novo arquivo `src/routes/portal/dashboard.tsx` (`/portal/dashboard`) com cards resumindo:
  - Projetos pendentes de aprovação (contagem + próximos 3).
  - Projetos aprovados no mês.
  - Próximas entregas / postagens (7 dias) a partir de `projects.due_date` / `post_date`.
  - Atalhos rápidos para Calendário, Pendentes, Aprovados e Estratégia.
- Dados via `supabase.from("projects").select(...)` filtrando pelo `client_id` acessível (RLS já restringe ao cliente logado).
- Atualizar `src/routes/portal/index.tsx` para redirecionar `/portal` → `/portal/dashboard`.
- Adicionar o item "Dashboard" no menu do `src/routes/portal.tsx` (primeiro item, ícone `LayoutDashboard`).

### 3. Verificação
- Login como cliente → cai em `/portal/dashboard`.
- Login como agência → cai em `/dashboard`.
- Cliente digitando `/dashboard` ou `/clientes` na URL é redirecionado para `/portal`.

## Detalhes técnicos

- Só mexer em: `src/routes/index.tsx`, `src/routes/_app.tsx`, `src/routes/login.tsx` (se necessário), `src/routes/portal.tsx`, `src/routes/portal/index.tsx`, novo `src/routes/portal/dashboard.tsx`.
- Sem alterações de schema/RLS: as policies existentes de `projects` já limitam por cliente.
- Manter o layout glass/gradiente já usado no portal para consistência visual.
