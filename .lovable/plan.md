# Filtros com múltipla escolha + múltiplos tipos de mídia

## 1. Filtros aceitando mais de um valor

Hoje cada filtro (Etapa, Cliente, Responsável, Prioridade, Tipo de mídia, Decisão) aceita apenas um valor. Passa a aceitar vários.

- O seletor do filtro vira uma lista com caixas de seleção: dá para marcar "Atendimento" e "Revisão" ao mesmo tempo.
- O botão do filtro mostra o resumo do que foi marcado (ex.: "Atendimento, Revisão" ou "3 selecionados").
- A demanda aparece se corresponder a **qualquer** um dos valores marcados do mesmo filtro; filtros diferentes continuam se somando (E entre filtros, OU dentro do filtro).
- Filtros de data (prazo/postagem de–até) continuam como estão.
- Os filtros salvos automaticamente (última configuração usada) continuam funcionando; configurações antigas de valor único são convertidas para o novo formato sem perder nada.
- Mesma mudança aplicada aos filtros do Calendário, para manter o comportamento igual nas duas telas.

## 2. Mais de um tipo de mídia por demanda

- No formulário de cadastro/edição da demanda, "Tipo de mídia" vira seleção múltipla (caixas de seleção), permitindo por exemplo Post + Story.
- Os tipos escolhidos aparecem como etiquetas no card do Kanban, na coluna da lista e no modal de detalhes (Demandas e Calendário).
- O filtro "Tipo de mídia" passa a considerar a demanda quando qualquer um dos seus tipos bate com os selecionados.
- Demandas já existentes mantêm o tipo atual sem nenhuma ação manual.

## Detalhes técnicos

- Nova tabela `project_media_types` (project_id, media_type_id, PK composta) com GRANTs e RLS espelhando as políticas de `projects` (leitura por quem pode ver o projeto via `can_view_project`, escrita para quem pode editar). Migração popula a tabela a partir de `projects.media_type_id`.
- `projects.media_type_id` é mantida e passa a guardar o primeiro tipo selecionado, garantindo compatibilidade com relatórios, portal do cliente e permissões de campo existentes.
- `src/routes/_app/projects.tsx`: `ActiveFilter` passa de `{ key, value: string }` para `{ key, values: string[] }` (datas usam `values[0]`); o `usePersistedState` dos filtros ganha migração do formato antigo. Novo componente reutilizável `MultiSelectFilter` (Popover + Checkbox) usado em Demandas e Calendário.
- Salvamento da demanda grava/sincroniza as linhas de `project_media_types` na mesma mutação e invalida as queries de projetos.
