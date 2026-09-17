# Corrigir erro ao abrir "Briefing & Estratégia"

## Problema

Ao abrir a aba Briefing & Estratégia em Clientes, a tela quebra com a mensagem
"Algo deu errado — Maximum update depth exceeded". A aba fica inutilizável.

## Causa

Na aba de briefing existe um trecho que carrega as senhas das redes sociais e,
logo em seguida, as copia para o formulário. Como a lista de senhas é recriada a
cada desenho da tela quando ainda não há dados carregados, essa cópia dispara um
novo desenho, que recria a lista, que dispara outra cópia — um ciclo infinito
que o React interrompe exibindo a tela de erro.

Isso só apareceu agora porque o campo de senha por rede social foi adicionado na
última rodada.

## Correção

- Deixar de copiar as senhas por efeito colateral: calcular o mapa de senhas
  diretamente a partir do que veio do banco, mesclado com o que o usuário digitou
  na sessão atual.
- Manter o campo de senha e o botão mostrar/ocultar funcionando exatamente como
  hoje, inclusive visível somente para administradores e gerentes.
- Garantir que, ao trocar de empresa, as senhas digitadas e não salvas sejam
  descartadas.

## Detalhes técnicos

Arquivo: `src/routes/_app/clientes.index.tsx`, componente `BriefingTab`.

- O `useQuery` de `client_social_secrets` usa `data: secrets = []`; com a query
  desabilitada/sem dados, o literal `[]` é uma referência nova a cada render, e o
  `useEffect([secrets])` chama `setSenhas` indefinidamente.
- Substituir o par `useState(senhas)` + `useEffect` por:
  - `senhasSalvas` derivado via `useMemo` de `secrets`;
  - `senhasEdit` (state) apenas com as alterações locais do usuário;
  - `senhas = { ...senhasSalvas, ...senhasEdit }` para leitura nos inputs;
  - `onChange` grava em `senhasEdit`.
- Limpar `senhasEdit` e `showSenha` quando `clientId` muda.
- A mutação `save` continua lendo do mapa combinado, sem outras mudanças.
- Verificação: `bunx tsgo --noEmit` + build, e abrir a aba com e sem senhas
  cadastradas.
