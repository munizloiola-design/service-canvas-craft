## Autorizações respeitam a data de cadastro

**Problema**: Hoje, ao selecionar um mês passado na aba Autorizações, aparecem todos os custos fixos / receitas recorrentes ativos — inclusive os que foram cadastrados depois daquele mês.

**Regra desejada**: um item recorrente só deve aparecer (e ser cobrado/recebido) a partir do mês em que foi cadastrado, enquanto estiver ativo.

### Mudança
Em `src/routes/_app/financeiro.tsx`, dentro de `Autorizacoes`:
- Ao montar `pendingRecur` e `pendingFixed`, filtrar também por `created_at`:
  - Manter o item apenas se `created_at <= monthEnd` (fim do mês selecionado).
- Mesma regra para o cálculo dos totais ("Total pendente" de receber/pagar).

### Fora de escopo
- `overdueItems` em `financeiro-calc.ts` já respeita `createdAt` — sem mudanças.
- Lançamentos avulsos e Relatório não são afetados (puxam de `financial_entries`).
