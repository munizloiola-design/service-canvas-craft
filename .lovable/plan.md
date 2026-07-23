# Plano de ajustes

## 1. Menu sanduíche some ao recolher
Em `src/routes/_app.tsx`, mover o `SidebarTrigger` para fora do `<Sidebar>` (colocá-lo no header/topbar principal sempre visível). Assim, mesmo com sidebar em modo `offcanvas`, o botão permanece acessível para reabrir.

## 2. Botão de tema claro/escuro
- Adicionar toggle no header do `_app.tsx` (ícone Sol/Lua) ao lado do `SidebarTrigger`.
- Persistir em `localStorage` (`theme`) e aplicar classe `dark` em `document.documentElement`.
- Ler preferência inicial em `useEffect` (evitar SSR mismatch).
- Também expor no portal do cliente (`src/routes/portal.tsx`).

## 3. Botões "Nova área/especialidade" sem função em /acessos
Em `src/routes/_app/acessos.tsx`, criar dois diálogos (`Dialog + Input`) para:
- Inserir em `provider_areas` (nome, key auto-slug).
- Inserir em `provider_specialties` (nome, área associada).
Recarregar listas via `queryClient.invalidateQueries` ao concluir.

## 4. Erro `notes` em `pending_registrations`
Coluna `notes` não existe. Migration para adicionar:
```sql
ALTER TABLE public.pending_registrations ADD COLUMN IF NOT EXISTS notes text;
```
(mantém os formulários atuais funcionando).

## 5. E-mails personalizados na tela de Cadastros
Na aba de cadastros (`src/routes/_app/cadastros.tsx`), adicionar seção "Modelos de e-mail" que:
- Lista templates de `email_templates`.
- Permite editar assunto/HTML de cada um.
- Botão "Novo modelo" abre diálogo para criar template (key, nome, subject, html).

## 6. Calendário — semana: destacar dia atual com cor primária 15%
Em `src/routes/_app/calendario.tsx`, na view Semana, remover o círculo do número e aplicar `background: color-mix(in oklab, hsl(var(--primary)) 15%, transparent)` à coluna inteira do dia atual (mantendo cabeçalho destacado).

## 7. Editar tela de login pelo sistema
Já existe em `personalizacao.tsx` (background/posição/textos). Ampliar para incluir:
- Texto do botão "Cliente" e "Agência".
- Descrição de cada opção.
- Cor do botão primário (se ainda ausente).
- Preview em tempo real da tela de login.
Salvar em `app_branding` (adicionar colunas necessárias via migration: `login_client_label`, `login_client_desc`, `login_agency_label`, `login_agency_desc`).

## 8. Categorias em despesas/receitas + configuração de custos fixos
- Nova tabela `financial_categories` (`id, name, kind` [`expense`|`income`], `is_fixed boolean`, `sort_order`).
- Adicionar `category_id uuid` em `financial_entries`, `fixed_costs`, `recurring_incomes`.
- No formulário de despesa/receita (`financeiro.tsx`), incluir Select de categoria filtrado por tipo.
- Nova aba/seção "Configurações do financeiro" para CRUD de categorias e flag "compõe custos fixos".
- Relatórios/orçamento passam a agrupar por categoria; total de custos fixos = soma das categorias marcadas `is_fixed`.

## 9. Orçamento — equipamentos e depreciação
- A tabela `equipments` já existe. Adicionar colunas (se faltarem): `purchase_value numeric`, `useful_life_months int`, `depreciation_per_use numeric` (via migration com defaults).
- No orçamento (`src/routes/_app/orcamento.tsx`), adicionar seção "Equipamentos necessários":
  - Multi-select de equipamentos + quantidade/dias de uso.
  - Custo direto do equipamento = `(purchase_value / useful_life_months) * (dias_uso / 30) * qtd` (ou `depreciation_per_use * qtd` se definido).
- Somar esse custo aos custos diretos do orçamento e mostrar linha detalhada.

## Detalhes técnicos
- Migrations SQL: (a) `ALTER pending_registrations ADD notes`; (b) criar `financial_categories` + GRANTs + RLS (managers escrevem, autenticados leem); (c) adicionar `category_id` em 3 tabelas financeiras com FK ON DELETE SET NULL; (d) colunas de depreciação em `equipments`; (e) colunas extras em `app_branding` para textos do login.
- Todos os selects e mutações via TanStack Query, invalidando keys após sucesso.
- Toggle de tema: usar `@custom-variant dark` já configurado no `styles.css`.
- Manter o design glass/gradient atual em todos os novos componentes.
