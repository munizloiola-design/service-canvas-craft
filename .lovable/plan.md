## Campo Comissão (%) em Custos Fixos e Receitas Recorrentes

### Banco
- Migration adicionando `commission_pct numeric NOT NULL DEFAULT 0` em:
  - `public.fixed_costs`
  - `public.recurring_incomes`

### Cadastros (formulários em `src/routes/_app/financeiro.tsx`)
- **Custos fixos**: novo input "Comissão (%)" ao lado de Valor; salvo em `commission_pct`. Coluna na tabela exibindo o %.
- **Receitas recorrentes**: idem (novo input "Comissão (%)" e coluna).
- Default 0; aceita decimais.

### Confirmações (gerar despesa de comissão)
Ao clicar em "Pago" (custo fixo) ou "Recebido" (receita recorrente):
1. Cria o `financial_entry` normal (como hoje).
2. Se `commission_pct > 0`, cria um segundo `financial_entry`:
   - `kind: 'expense'`
   - `amount = valor_base * commission_pct / 100`
   - `description: "Comissão — <nome do item>"`
   - `category: 'comissao'`
   - `source_type` + `source_id` apontando para o item de origem (mesmo vínculo), para idempotência via `(source_type, source_id, month_floor(entry_date))`. *Observação*: o índice único atual impede duplicar comissão+principal no mesmo mês com mesma chave. Para evitar colisão, usaremos `source_type = 'fixed_cost_commission' | 'recurring_income_commission'` no entry de comissão.

### Idempotência
- Antes de inserir, checar se já existe entry com o mesmo `source_type` de comissão + `source_id` + mês — pular se existir (mesma lógica já usada em `confirmIncome`/`confirmExpense`).

### Cálculos
- KPIs e gráfico continuam puxando de `financial_entries` — comissão aparecerá automaticamente como saída do mês. Sem mudanças em `financeiro-calc.ts`.

### Fora de escopo
- Não altera a aba Lançamentos avulsos.
- Não cria nova categoria/configuração global; comissão é por item.
