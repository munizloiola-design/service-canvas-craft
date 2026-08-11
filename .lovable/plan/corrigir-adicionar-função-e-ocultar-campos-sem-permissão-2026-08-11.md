# Corrigir "adicionar função" e ocultar campos sem permissão

## 1. Não consigo adicionar função (Vinicius)

O sintoma descrito — a página salta para o topo e o dropdown fecha sem salvar — vem de como a lista de pessoas é montada em Perfis e Acessos › Usuários: o cartão de cada pessoa (`MemberCard`) é criado dentro do corpo de renderização da tela. A cada mudança de estado (inclusive abrir o seletor de função) o React trata esse cartão como um componente novo, desmonta e remonta a lista inteira. Resultado: o popover fecha no mesmo instante em que abre, a rolagem volta ao topo e o clique na função não chega a ser registrado. Pessoas no fim da lista (Vinicius, Thiago) sentem mais porque perdem a posição de rolagem.

Correção:
- Extrair o cartão da pessoa para um componente estável, definido fora da tela, recebendo os dados por props.
- Manter a posição de rolagem e o popover aberto até a escolha; ao escolher, salvar e fechar.
- Confirmar visualmente com um teste no navegador: abrir o seletor no último colaborador da lista e atribuir uma função.

Observação: as permissões do banco estão corretas (administradores podem atribuir funções), então nada muda no banco.

## 2. Campo sem permissão deve sumir, não aparecer vazio

Hoje o comportamento é misto:
- **Detalhe da demanda**: já oculta corretamente.
- **Formulário de nova demanda / edição**: mostra todos os campos, mesmo os que a função não pode ver ou editar.
- **Lista**: a coluna some da tabela, mas continua listada no menu "Colunas" como "(bloqueado)".

Passa a valer uma regra única em todo o sistema: **sem permissão de ver = o campo não é renderizado**; com permissão de ver mas sem editar = campo somente leitura.

- Formulário de demanda: cada campo controlado (Cliente, Tipo de mídia, Prioridade, Prazo, Postagem, Descrição, Direção de arte, Legenda, Links de referência, Entregável, Orçamento, Feedback do cliente) só aparece quando a função libera "Ver"; quando libera só "Ver" e não "Editar", aparece em modo leitura.
- Lista de demandas: colunas bloqueadas somem também do menu "Colunas" (em vez de aparecer desabilitadas).
- Abas/seções já ocultas pelo gate de seções continuam como estão.
- O padrão permissivo atual é mantido: função sem nenhuma regra cadastrada continua vendo tudo.

## Detalhes técnicos

- `src/routes/_app/acessos.tsx`: mover `MemberCard` para fora de `AssignTab` (componente de módulo com props: membro, funções, áreas, mutations, estado do popover), mantendo `assign`/`unassign`/`setRole` inalterados.
- `src/routes/_app/projects.tsx`: aplicar `useFieldVisibility()` (`canSee`/`canEdit`) dentro de `NewDemandDialog` para renderização condicional e modo leitura; no dropdown "Colunas", filtrar `ALL_COLUMNS` por `isColBlocked` em vez de desabilitar.
- Sem migração de banco.
