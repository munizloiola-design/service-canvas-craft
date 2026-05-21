## Objetivo

Refinar a aba Financeiro para que custos fixos e receitas recorrentes funcionem como **previsões** até serem confirmados, permitir edição dos cadastros recorrentes, marcar receitas como **comissão**, e adicionar **emissão de relatório por período**.

Arquivo único afetado: `src/routes/_app/financeiro.tsx`. Sem mudanças de schema.

---

### 1. Custos fixos e receitas recorrentes só contam após "OK"

KPIs e gráfico já leem só `financial_entries`, então o "Realizado" já está correto. Ajuste de UI:

- **Cards do topo** (Previsão do mês): manter "Receitas/Despesas/Saldo previstos" mostrando o que **viria** dos recorrentes + fixos, e adicionar ao lado **"Realizado"** (só `financial_entries`).
- **Gráfico "Últimos 12 meses"**: continua somando só lançamentos reais. Adicionar legenda explicando que custos fixos/recorrentes só entram após confirmação.
- Aba **"Confirmações do mês"** continua sendo onde se marca "Recebido" / "Pago" (lógica já existe).

### 2. Edição de custos fixos e receitas recorrentes

Hoje só dá pra criar e excluir. Adicionar:

- Botão **Editar** (ícone lápis) em cada linha.
- Reutilizar o mesmo dialog em modo "edição" (preenche campos e faz `update` em vez de `insert`).

### 3. Previsão de despesa/receita com base em recorrentes

Refinar o card "Previsão do mês" com quebra clara:

```text
Receitas previstas: R$ X
  └ Realizado: R$ Y
  └ A receber: R$ Z

Despesas previstas: R$ A
  └ Realizado: R$ B
  └ A pagar:   R$ C
```

Adicionar barra "X de Y pagamentos confirmados" (análoga à de recebimentos).

### 4. Marcar receita como comissão em Lançamentos

No formulário de "Novo lançamento" (quando `kind = income`):

- **Checkbox "É comissão"** → grava `category = "comissao"`.
- Na tabela, exibir badge **"Comissão"** ao lado da descrição.

### 5. Emissão de relatório por período (nova aba)

Nova aba **"Relatórios"** com:

- Dois inputs de data: **De** / **Até** (default: mês atual).
- Botão **"Gerar relatório"** que filtra `financial_entries` no período.
- Resumo: total de receitas, total de despesas, saldo, receitas de comissão, top 5 categorias.
- Tabela com todos os lançamentos do período.
- Dois botões de exportação:
  - **Exportar CSV** (download direto, sem deps).
  - **Imprimir / PDF** (usa `window.print()` com CSS print-only na área do relatório).

---

### Detalhes técnicos

- Sem migration — todas as colunas já existem (`financial_entries.category`, `fixed_costs.*`, `recurring_incomes.*`).
- Edição: `useMutation` + `invalidateQueries`. Dialog controlado por `editingItem` opcional.
- Comissão: usa `Checkbox` shadcn já no projeto.
- Relatório: query com `.gte('entry_date', from).lte('entry_date', to)`. CSV gerado em memória + `Blob` + link. Impressão via classe `print:block` / `print:hidden`.

Posso seguir com a implementação?
