## Problema

No menu lateral (`src/routes/_app.tsx`), a marcação de item ativo usa `pathname.startsWith(item.to)`. Como o item "Times" aponta para `/squad` e "Relatório" para `/squad/relatorio`, ao acessar `/squad/relatorio` ambos ficam destacados — "Times" continua marcado porque `/squad/relatorio` começa com `/squad`.

## Correção

Ajustar a lógica de `active` na linha 143 de `src/routes/_app.tsx` para casar exatamente quando o item tem submenus/rota base, ou usar correspondência por segmento:

- Substituir `pathname.startsWith(item.to)` por:
  - `pathname === item.to || pathname.startsWith(item.to + "/")` para itens sem filhos no mesmo grupo, **e**
  - Para itens cuja rota é prefixo de outro item do mesmo grupo (ex.: `/squad` vs `/squad/relatorio`), usar apenas igualdade exata (`pathname === item.to`).

Implementação: para cada item, verificar se existe outro item no mesmo grupo com `to` que começa com `item.to + "/"`. Se sim, ativo apenas quando `pathname === item.to`. Caso contrário, ativo quando `pathname === item.to || pathname.startsWith(item.to + "/")`.

Sem outras mudanças; comportamento de `groupActive` na linha 167 continua correto.