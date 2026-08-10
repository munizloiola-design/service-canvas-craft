# Card do Kanban colorido pela prioridade

## O que muda
No quadro Kanban, cada card de demanda passa a ter o fundo na cor da prioridade cadastrada, com 50% de opacidade (metade da intensidade da cor original). Cards sem prioridade definida continuam com o fundo padrão.

Detalhes visuais:
- Fundo do card: cor da prioridade a 50% de opacidade.
- Borda esquerda em destaque com a cor cheia da prioridade, para reforçar a leitura rápida.
- O badge de prioridade continua no canto superior direito.
- Texto e o seletor de etapa dentro do card mantêm contraste legível sobre o fundo colorido.
- Funciona igual no tema claro e escuro (a cor vem do cadastro de prioridades).

## Detalhes técnicos
- Arquivo: `src/routes/_app/projects.tsx`, componente do card do Kanban (por volta da linha 545-558).
- Aplicar `style.background = <cor da prioridade> + "80"` (alfa 50% em hex) e `borderLeft: 3px solid <cor>` quando `pr` existir.
- Manter o restante do card (drag-and-drop, clique para detalhe, select de etapa) inalterado.
- Nenhuma mudança em banco de dados, permissões ou na visão de Lista.

## Observação
50% de opacidade deixa a cor bem forte. Se ficar pesado depois de ver na tela, dá para reduzir para ~20-25% em um ajuste rápido.
