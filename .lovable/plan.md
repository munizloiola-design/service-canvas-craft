# Calendário: expandir o dia e modal responsivo

## 1. Clicar no "+N" expande o dia

Hoje, quando um dia tem mais tarefas do que cabe na célula (3 na visão Mês), aparece apenas um selo "+2" sem ação.

Mudança:
- O selo "+N" vira um botão.
- Ao clicar, aquele dia expande dentro da própria grade e mostra **todas** as tarefas do dia (a célula cresce conforme necessário).
- Clicar novamente em "mostrar menos" volta ao estado compacto.
- O estado expandido é por dia e reinicia ao trocar de mês/semana ou de aba (Prazos/Postagens).
- Arrastar e soltar continua funcionando normalmente na célula expandida.

## 2. Modal da tarefa responsivo com rolagem

O modal de detalhes hoje pode estourar a altura da tela em telas menores, cortando descrição, direção de arte e legenda.

Mudança:
- Altura máxima limitada à tela (com margem), com o corpo do modal rolando de forma independente.
- Cabeçalho (título) e rodapé (botões) ficam fixos; só o conteúdo rola.
- Largura adaptada ao celular (quase largura total) e maior no desktop.
- Título com quebra de linha em vez de corte.
- Os blocos de datas passam a empilhar no celular.

## Detalhes técnicos

Arquivo único: `src/routes/_app/calendario.tsx`

- Novo estado `expandedDay: string | null`; `maxVisible` passa a ser `Infinity` quando `expandedDay === key`.
- `minH` da célula continua igual; a célula expandida usa `h-auto` e remove o `overflow-y-auto` limitante.
- `setExpandedDay(null)` em `setCursor`, na troca de `view` e de `tab`.
- `DialogContent`: `w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] flex flex-col p-0`, com header/footer `px-6 py-4 shrink-0` e o corpo em `overflow-y-auto px-6`.
