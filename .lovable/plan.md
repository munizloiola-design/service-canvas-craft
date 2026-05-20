## Diagnóstico do gráfico

O gráfico "Últimos 12 meses" lê **apenas** `financial_entries` (kind=income/expense). Hoje no banco existem:
- 1 entrada (`income` R$ 90)
- 3 custos fixos ativos (R$ 800) — em `fixed_costs`, **não** em `financial_entries`

Resultado: a barra "Saídas" fica zerada porque o que você cadastrou foram **custos fixos** (recorrentes), não lançamentos avulsos de saída. O gráfico ignora `fixed_costs`, impostos e depreciação — só os cards de KPI somam tudo.

## Plano

### 1. Corrigir o gráfico "Últimos 12 meses"
Incluir nas barras de **Saídas** de cada mês: lançamentos `expense` + parcela mensal dos custos fixos ativos (mensal = amount; anual = amount/12) + impostos do mês (income × tax_pct) + depreciação mensal dos equipamentos.

Adicionar uma terceira série **"Resultado"** (linha) usando `ComposedChart` para acompanhar o líquido mês a mês.

### 2. Nova seção "Previsão do mês"
Card no topo do financeiro com:
- **Receitas previstas**: soma de `recurring_incomes` ativas + entradas já lançadas no mês
- **Despesas previstas**: `fixed_costs` ativos (rateados) + saídas já lançadas + impostos estimados + depreciação
- **Saldo previsto** vs **Saldo realizado** (apenas o que já virou `financial_entries`)
- Barra de progresso "X de Y receitas recorrentes recebidas neste mês"

### 3. Aba/seção "Confirmar recebimentos do mês"
Lista todas as `recurring_incomes` ativas com checkbox "Recebido". Marcar cria automaticamente um `financial_entries` (kind=income, description=descrição da recorrente, client_id, amount, entry_date=hoje) e atualiza `next_due` da recorrente para o próximo período.

Mesma lógica espelhada para `fixed_costs`: lista "Pagamentos do mês" com checkbox "Pago" que gera o `financial_entries` (kind=expense).

Cada item mostra: descrição, valor, vencimento (`due_day` ou `next_due`), status (Pendente/Confirmado no mês corrente — detectado por matching de descrição + período).

### Detalhes técnicos
- Arquivo único afetado: `src/routes/_app/financeiro.tsx`
- Sem mudanças de schema (todas as tabelas já existem: `recurring_incomes`, `fixed_costs`, `financial_entries`)
- Mutations via `useMutation` + `queryClient.invalidateQueries`
- Marcação "já confirmado neste mês" detectada por: existir `financial_entries` no mês corrente com `description` igual ao da recorrente/custo fixo
- Uso de `Checkbox`, `Progress`, `Tabs` (todos já no projeto via shadcn)

Quer que eu siga com essa implementação?
