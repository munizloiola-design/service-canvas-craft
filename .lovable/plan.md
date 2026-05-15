## 1. Edição completa de demandas (Projetos)

Hoje o `ProjectDetailDialog` (src/routes/_app/projects.tsx, linhas ~530–680) só permite editar `status_id` e `priority_id` direto pelos selects. Título, descrição, observações, cliente, tipo de mídia, datas, orçamento, links de referência e responsáveis são apenas leitura.

Mudanças:
- Adicionar botão **"Editar demanda"** no `DialogFooter` (gestores) que alterna o diálogo para um modo de edição (reaproveitando o componente do `NewDemandDialog` em formulário pré-preenchido) — incluindo:
  - Título, descrição, observações
  - Cliente, tipo de mídia, prioridade, etapa
  - Datas: início, prazo, postagem
  - Orçamento
  - Reference links (adicionar/remover)
  - Responsáveis (substituir todos os `project_assignees` numa única transação)
  - Anexos: permitir excluir anexos existentes e adicionar novos (`project_attachments` + storage `project-files`)
  - Material para o cliente (`deliverable_path`): substituir/remover
- Salvar via `supabase.from("projects").update(...)` + sync de `project_assignees` (delete + insert) e attachments.
- Mantém os atalhos inline de status/prioridade no modo visualização.

## 2. Edição de simulações de orçamento

Hoje em src/routes/_app/orcamento.tsx as simulações salvas só listam (linhas 155–172). A política RLS `bs_*` não tem UPDATE — usuários nem podem editar.

Mudanças:
- **Migração**: adicionar policy `bs_update` para `is_manager(auth.uid())` na tabela `budget_simulations` (e `updated_at` opcional para ordenar).
- Adicionar coluna de ações na lista de simulações com:
  - **Carregar**: preenche o formulário (`name`, `hours`, `fixedTotal`, `profitPct`, `taxPct`, `pros`) com a simulação selecionada e entra em modo edição (estado `editingId`).
  - **Excluir**: `delete` da simulação (já permitido por RLS).
- Botão "Salvar simulação" passa a fazer `update` quando `editingId` está setado, ou `insert` caso contrário. Adicionar botão "Nova simulação" para limpar o estado.

## 3. Otimização da responsividade para celular

Problemas atuais:
- `src/routes/_app.tsx`: sidebar `w-64` fixa visível em todas as telas — ocupa metade do celular.
- Várias páginas usam `p-8` (sem `px-4`), tabelas largas sem scroll, grids de 2/4 colunas sem fallback `grid-cols-1`.

Mudanças:
- **Layout (`_app.tsx`)**:
  - Topbar mobile (`md:hidden`) com logo + botão menu (Sheet do shadcn) que abre a sidebar como drawer.
  - Sidebar: `hidden md:flex` em desktop, dentro do `Sheet` em mobile.
  - `main`: adicionar `pt-14 md:pt-0` para compensar topbar.
- **Páginas principais** (projects, orcamento, tickets, financeiro, dashboard, personalizacao, equipamentos, team, cadastros):
  - Trocar `p-8` por `p-4 md:p-8`.
  - Headers com flex: `flex-col gap-3 md:flex-row md:items-center md:justify-between`.
  - Tabelas envoltas em `<div className="overflow-x-auto">`.
  - Grids: garantir `grid-cols-1` no mobile (ex.: orçamento `grid-cols-2 md:grid-cols-4` está ok; revisar outras).
  - Diálogos: `max-w-2xl` ok; adicionar `w-[95vw]` para mobile.
- Kanban de projetos: garantir scroll horizontal em telas estreitas.

## Arquivos afetados
- src/routes/_app.tsx (topbar + drawer)
- src/routes/_app/projects.tsx (modo editar + responsivo)
- src/routes/_app/orcamento.tsx (carregar/excluir/atualizar simulação + responsivo)
- src/routes/_app/{tickets,financeiro,dashboard,personalizacao,equipamentos,team,cadastros}.tsx (paddings/grids/tabelas responsivas — passes pontuais)
- nova migração: policy de UPDATE em `budget_simulations`

## Detalhes técnicos
- Sync de assignees: `delete` por `project_id` + `insert` da nova lista (igual padrão do NewDemandDialog).
- Edição reaproveita o mesmo formulário do `NewDemandDialog` extraindo-o para um componente compartilhado `DemandForm` com prop `initialValues` e `mode: 'create' | 'edit'`.
- No orçamento, ao "Carregar" simulação, popular `pros` a partir do JSON (`professionals`), `editingId` controla o botão Salvar.
