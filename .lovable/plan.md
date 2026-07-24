## Diagnóstico do "CRM sumido"

A rota `/clientes/crm` existe (`src/routes/_app/clientes.crm.tsx` → renderiza `CrmTab` de `clientes.tsx`) e o link no menu aponta para ela. O `CrmTab` só mostra colunas quando há clientes com `status = 'prospeccao'`; sem prospects ele renderiza o cabeçalho + card "Nenhum cliente em prospecção. Cadastre um cliente com status Prospecção no Diretório para começar." — provavelmente é isso que você está vendo (só o topo da página, sem o kanban).

Confirmação a fazer na 1ª etapa do build: abrir `/clientes/crm` no preview e checar console/DB — se houver ≥1 cliente com `status='prospeccao'`, é bug de render; se não houver, é o empty state esperado.

## Estágios editáveis (add / editar / remover)

Hoje os estágios são a constante `STAGES` no código. Vou mover para uma tabela e criar UI de gestão.

### 1. Banco
Nova tabela `crm_stages`:
- `name` (text, único)
- `sort_order` (int)
- `is_won` (bool), `is_lost` (bool) — marcam os estágios terminais (movem `clients.status` para `ativo`/`inativo`)
- `color` (text opcional, hex)
- timestamps padrão

RLS: leitura para `authenticated`; escrita só para managers (`is_manager(auth.uid())`). GRANT para `authenticated` e `service_role`.

Seed com os 6 estágios atuais (Ganho = is_won, Perdido = is_lost).

### 2. CrmTab (`src/routes/_app/clientes.tsx`)
- Substituir constante `STAGES` por `useQuery(["crm_stages"])`.
- Ordenar colunas por `sort_order`.
- Ao soltar em coluna com `is_won` → `status='ativo'`; `is_lost` → `status='inativo'`; senão só grava `prospect_stage`.
- Dialog do card: `Select` populado a partir dos estágios do banco.
- Empty-state atual continua; adiciono um botão "Gerenciar estágios" no topo do CRM que abre o dialog abaixo (visível mesmo sem prospects, resolvendo a percepção de "página vazia").

### 3. UI de gestão de estágios
Novo componente `StagesManagerDialog` dentro de `clientes.tsx`:
- Lista os estágios com input inline para renomear, toggles "Ganho" / "Perdido", botões ↑ ↓ para reordenar (`sort_order`), lixeira para excluir.
- Botão "Adicionar estágio" (nome + posição no fim).
- Regras: não deixar excluir estágio que tem prospects vinculados (checar `clients.prospect_stage`); em vez disso pedir para mover antes. Toast com `describeSupabaseError` em falhas.
- Só managers veem/editam (a página inteira já é gated por `isManager`).

### 4. Página CRM (`src/routes/_app/clientes.crm.tsx`)
Sem mudança estrutural — continua renderizando `CrmTab`. O botão "Gerenciar estágios" fica dentro de `CrmTab`.

## Fora de escopo
- Migração de `prospect_stage` para FK — mantenho como texto para não quebrar dados existentes; renomear estágio atualiza os `clients` correspondentes numa mesma transação (UPDATE em `clients` quando o `name` muda).

## Detalhes técnicos
- Migração cria tabela + RLS + GRANT + seed dos 6 estágios em uma única call ao `supabase--migration`.
- Renomear estágio: mutation dispara `UPDATE clients SET prospect_stage=novo WHERE prospect_stage=antigo` + `UPDATE crm_stages`.
- Reordenar: dois updates de `sort_order` numa mutation.
- Tipos do Supabase serão regenerados após a migration aprovada; só então edito `clientes.tsx`.