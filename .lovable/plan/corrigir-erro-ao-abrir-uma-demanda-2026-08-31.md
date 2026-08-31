# Corrigir erro ao abrir uma demanda

Ao clicar em uma demanda, a tela quebra com o erro React #310. Causa confirmada: no modal de detalhes da demanda, a consulta dos tipos de mídia é feita depois de um retorno antecipado do componente, o que viola a ordem de execução esperada pelo React quando o modal alterna entre fechado e aberto.

## Correção

- Em `src/routes/_app/projects.tsx`, no componente `ProjectDetail`: mover a chamada `useProjectMediaTypes()` (hoje na linha 1341, depois do `if (!project) return null`) para junto dos demais hooks no topo do componente.
- Manter o `if (!project) return null` e o cálculo de `validationUrl`/`pr` como estão, apenas abaixo de todos os hooks.
- Revisar os outros usos de `useProjectMediaTypes()` no arquivo (card do Kanban, lista e diálogo de cadastro) para garantir que nenhum esteja após um retorno antecipado.

Sem mudanças de banco, de permissões ou de layout.
