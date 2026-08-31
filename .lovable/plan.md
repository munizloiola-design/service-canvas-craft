# Corrigir contagem de "em aberto" e "atrasado" por especialidade

## O que está acontecendo

Consultei as regras cadastradas em Perfis e Acessos. Hoje elas estão assim:

```text
Fluxo:  1 Atendimento · 2 Planejamento · 3 Aguardando Produção · 4 Produção
        5 Revisão · 6 Correção · 7 Validação do cliente
        8 Aguardando Programar · 9 Programado · 10 Concluído

Designer      → início: 3 Aguardando Produção   conclusão: 7 Validação do cliente
Social Media  → início: 2 Planejamento          conclusão: 7 Validação do cliente
```

Ou seja, para o Designer (José Henrique, Pedro, Vinicius) as fases 5 Revisão e
6 Correção ainda são consideradas trabalho em aberto — por isso entram em
"em aberto" e podem virar "atrasado". O cálculo está correto; o cadastro é que
não reflete a regra real (o Designer entrega em Revisão).

## O que vou fazer

1. Ajustar a regra de conclusão do Designer para **5. Revisão**. A partir daí,
   Revisão, Correção, Validação do cliente e o restante do fluxo contam como
   entregues para o Designer — inclusive Correção, conforme você confirmou.
2. Manter Social Media concluindo em **7. Validação do cliente** e revisar as
   demais especialidades cadastradas para garantir que cada uma tenha início e
   conclusão definidos (especialidades sem regra hoje caem no "final global" do
   fluxo, o que infla os números).
3. Conferir, após o ajuste, os números do dashboard filtrando por José Henrique
   e por um Social Media, para confirmar que Revisão saiu de "em aberto" e de
   "atrasado".

## Detalhes técnicos

- Ajuste de dados na tabela `specialty_stage_rules` (marcar `is_done` na etapa
  Revisão para a especialidade Designer e remover o `is_done` da etapa Validação
  do cliente dessa especialidade). Nenhuma mudança de schema.
- A lógica em `src/lib/access-sections.ts` (`buildStageRules`) já trata
  "conclusão" como "da fase marcada em diante", o que atende à decisão de que
  Correção segue entregue. Nenhuma alteração de código necessária nesse ponto.
- Validação com consulta às demandas por status para comparar antes/depois.
