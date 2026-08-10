# Reduzir opacidade do card do Kanban para 10%

## Resumo
O fundo do card no Kanban usa hoje a cor da prioridade a 50% (`${pr.color}80`). Reduzir para 10% (`${pr.color}1A`), mantendo a borda lateral esquerda e o selo de prioridade na cor cheia.

## Mudança
Arquivo: `src/routes/_app/projects.tsx` (~linha 551)

- Atual: `background: \`${pr.color}80\``  (50%)
- Novo:  `background: \`${pr.color}1A\``  (10%)

O `borderLeft: '3px solid ${pr.color}'` e o badge de prioridade (`${pr.color}25` / cor cheia) permanecem inalterados, preservando o acento forte na borda.

## Verificação
- Abrir `/projects` (visão Kanban) e confirmar que os cards mostram um tom sutil da cor da prioridade, com a borda esquerda e o selo na cor cheia.
- Confirmar que o conteúdo do card (título, badges, responsáveis, datas) continua legível.
