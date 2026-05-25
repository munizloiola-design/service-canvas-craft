## Diagnóstico

Auditei `src/routes/_app/financeiro.tsx` (Resumo, Confirmações, Realizados) e `src/lib/financeiro-calc.ts`. Encontrei 5 causas reais de "está contabilizando errado":

1. **Confirmação não é idempotente.** Clicar duas vezes em "Confirmar" (ou em "Confirmar atraso") cria duas linhas em `financial_entries` com o mesmo `(source_type, source_id, mês)`. Os KPIs ("Entradas/Saídas do mês"), o painel "Receitas/Custos confirmados" e o gráfico de 12 meses passam a somar 2x. Não há índice único nem checagem antes do insert.
2. **Coluna "Atrasados" lista meses anteriores à criação da origem.** `overdueItems` percorre os últimos 12 meses para todo item ativo. Um custo fixo cadastrado hoje aparece como atrasado em 12 meses — gerando uma lista enorme e falsa.
3. **Resumo mistura definições.** "Saldo realizado" = `incomes − expenses` (sem imposto), mas "Resultado líquido" = `incomes − expenses − taxes`. O KPI "Custos fixos pagos (mês)" parece somar à parte mas já está dentro de "Saídas (mês)" — visualmente sugere que é deduzido duas vezes.
4. **Totais de "Confirmações" usam o `amount` da origem, não da entry.** Se o valor de uma receita recorrente/custo fixo for alterado depois da confirmação, o painel de Confirmações mostra um total diferente do realizado em Resumo.
5. **Não dá pra desfazer a confirmação na própria coluna.** Hoje só nas abas "Realizados". Quando o usuário confirma errado, precisa trocar de aba para corrigir.

## Mudanças

### 1. Banco — proteção contra duplicata (migration)

- Criar índice único parcial em `financial_entries`:
  `UNIQUE (source_type, source_id, date_trunc('month', entry_date)) WHERE source_id IS NOT NULL`.
- Antes de criar o índice, deduplicar linhas existentes: manter a mais antiga por `(source_type, source_id, mês)`, apagar as demais.

### 2. `src/lib/financeiro-calc.ts`

- Estender `RecurringIncome` e `FixedCost` com `createdAt?: string` opcional.
- Em `overdueItems`, pular meses anteriores ao `createdAt` da origem (quando presente). Mantém retrocompatibilidade.
- Adicionar testes em `src/lib/__tests__/financeiro-flow.integration.test.ts`:
  - confirmação repetida não duplica (helper idempotente);
  - item criado mês corrente não aparece em atrasos passados.

### 3. `src/routes/_app/financeiro.tsx` — Confirmações

- `confirmIncome` / `confirmExpense`: antes do `insert`, checar `findEntryForSource` no `monthEntries`; se já existe, mostrar `toast.info("Já confirmado neste mês")` e retornar. Tratar erro `23505` (violação de unique) com a mesma mensagem amigável.
- Botão "Desfazer" inline nas colunas "Receber (mês)" e "Pagar (mês)" para itens já confirmados (mostra valor confirmado, data, e ação de remover a entry).
- Totais "Receitas/Custos confirmados" passam a somar o **valor da entry encontrada** (`findEntryForSource(...).amount`) em vez do `r.amount`/`monthly`. Garante paridade com o Resumo.
- Passar `createdAt` da origem para `overdueItems` (campo `created_at` já vem do select).

### 4. `src/routes/_app/financeiro.tsx` — Resumo (consistência)

- Remover o KPI "Custos fixos pagos (mês)" da grade principal (já está em "Saídas"); mover esse breakdown para o card "Previsão do mês" onde já existe a divisão Realizado/A pagar.
- Renomear "Saldo realizado" → "Resultado realizado" e calcular como `incomes − expenses − taxes` (igual ao "Resultado líquido"). Eliminar o card duplicado "Resultado líquido" da grade superior — fica só "Resultado realizado" e "Saldo previsto".
- Mover "Depreciação (mês)" para dentro do card "Previsão do mês" como linha informativa (não é KPI realizado).
- Acrescentar texto curto sob cada card explicando a definição (tooltip-like, `text-xs text-muted-foreground`).

### 5. UI — pequena reorganização

- Agrupar abas "Custos fixos" e "Receitas recorrentes" sob uma única aba **"Cadastros"** com sub-tabs internas. Reduz de 9 para 8 triggers e deixa claro que são cadastros (origem das confirmações), não realizados.
- Manter as demais abas como estão.

## Arquivos afetados

- `supabase/migrations/<timestamp>_financial_entries_unique_per_month.sql` (novo)
- `src/lib/financeiro-calc.ts` (`createdAt` + filtro em `overdueItems`)
- `src/lib/__tests__/financeiro-flow.integration.test.ts` (2 testes novos)
- `src/routes/_app/financeiro.tsx` (Resumo, Confirmações, agrupamento de abas)
- `.lovable/plan.md` (atualizar)

## Fora do escopo

Não vou alterar a lógica de imposto (continua `incomes × tax_pct`), nem mexer em `Lançamentos`, `Relatórios` ou `Configurações`.
