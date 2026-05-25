## Objetivo

Reorganizar a aba **"Confirmações do mês"** em 4 colunas (Receber mês / Pagar mês / Próximos / Atrasados) e criar duas novas abas — **"Recebimentos realizados"** e **"Pagamentos realizados"** — com busca por coluna. Mudança apenas de UI em `src/routes/_app/financeiro.tsx`. Sem migration.

---

## 1. Aba "Confirmações do mês" — 4 colunas

Layout em grid responsivo (`grid-cols-1 lg:grid-cols-2 xl:grid-cols-4`).

```text
┌────────────────┬────────────────┬────────────────┬────────────────┐
│ Receber (mês)  │ Pagar (mês)    │ Próximos       │ Atrasados      │
│ recorrentes    │ custos fixos   │ (mês seguinte) │ (meses passa-  │
│ pendentes do   │ pendentes do   │ recorr. + fix. │  dos sem       │
│ mês selecio.   │ mês selecio.   │ previstos      │  confirmação)  │
└────────────────┴────────────────┴────────────────┴────────────────┘
```

**Lógica por coluna:**
- **Receber mês**: `pendingRecurring(recurring, monthEntries)` para o mês selecionado. Botão "Confirmar" cria entry como hoje.
- **Pagar mês**: `pendingFixed(fixed, monthEntries)` para o mês selecionado. Botão "Confirmar".
- **Próximos** (mês seguinte ao selecionado): roda `pendingRecurring`/`pendingFixed` com `monthEntries` do mês +1 e mostra os dois tipos com badge (Receita/Despesa). Sem botão Confirmar (só leitura — confirma no mês certo).
- **Atrasados**: itera meses anteriores a partir de um teto (12 meses para trás) e lista qualquer recorrente/custo fixo ativo que não tem entry confirmada naquele mês. Cada linha mostra mês de referência + valor. Botão "Confirmar atraso" gera entry com `entry_date` no primeiro dia do mês em atraso (mantendo `source_type`/`source_id`).

Quando um item é confirmado, automaticamente "some" da coluna do mês e o do mês seguinte continua aparecendo em "Próximos" — comportamento natural pois a query reativa.

## 2. Novas abas "Recebimentos realizados" e "Pagamentos realizados"

Duas novas `TabsTrigger`:
- `realizados-rec` → tabela de `financial_entries` com `kind='income'`.
- `realizados-pag` → tabela de `financial_entries` com `kind='expense'`.

Cada tabela tem **busca por coluna** (input no header) para: Data, Descrição, Origem (source_type legível), Valor. Filtro client-side com `useMemo`. Ordenação por data desc por padrão.

Reaproveita componente único `<RealizadosTable kind="income"|"expense" />`.

## 3. Detalhes técnicos

- Helper novo em `src/lib/financeiro-calc.ts`: `overdueItems({ recurring, fixed, entries, today, monthsBack=12 })` que retorna `Array<{ kind, source, monthDate, amount, description }>` — usado pela coluna Atrasados e testável.
- Reusar `buildConfirmationEntry` para criar entry de atraso (passando a data do mês atrasado).
- Adicionar 2-3 testes em `financeiro-flow.integration.test.ts` cobrindo: detecção de atrasado, confirmar atraso remove da lista, próximo mês aparece na coluna "Próximos".
- A aba "Confirmações do mês" mantém o seletor de mês existente; as 4 colunas reagem a ele.

## Arquivos afetados
- `src/routes/_app/financeiro.tsx` (refatorar `Confirmacoes`, adicionar `RealizadosTable` e 2 novas tabs)
- `src/lib/financeiro-calc.ts` (novo helper `overdueItems`)
- `src/lib/__tests__/financeiro-flow.integration.test.ts` (novos casos)

Posso seguir com a implementação?
