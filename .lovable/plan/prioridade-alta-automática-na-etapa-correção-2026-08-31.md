# Prioridade ALTA automática na etapa Correção

Hoje a prioridade só muda manualmente. A ideia: sempre que uma demanda entrar na etapa **Correção**, a prioridade dela sobe automaticamente para **Alta** — não importa por onde a mudança aconteceu.

## Como vai funcionar

- Ao arrastar o card no Kanban para Correção, trocar a etapa na Lista, no Calendário ou no modal de edição, a prioridade passa a ser **Alta** na hora, sem nenhuma ação extra.
- Se a demanda estiver como **Urgente** (nível acima de Alta), ela **permanece Urgente** — a automação nunca rebaixa a prioridade.
- Se a demanda estiver Baixa ou Média, sobe para Alta.
- Ao sair da etapa Correção, a prioridade **não volta** ao valor anterior (fica Alta até alguém mudar manualmente).
- Nenhuma configuração nova em Perfis e Acessos: a regra vale para todos.

## Detalhes técnicos

- **Banco de dados (migração única)**: gatilho `BEFORE UPDATE OF status_id` em `public.projects`. Quando o novo `status_id` for uma etapa chamada "Correção" (busca por nome, case-insensitive), ajusta `NEW.priority_id` para a prioridade de nome "Alta", somente se a prioridade atual for de nível menor (`priorities.level` < nível da Alta). Assim Urgente não é rebaixada e nomes/etapas futuras não quebram a regra.
- Fazer via gatilho no banco cobre **todos** os caminhos de mudança de etapa de uma vez: `update_project_schedule` (Kanban/Lista/Calendário), o update genérico do modal de edição e a seleção de etapa no modal de detalhes — sem precisar tocar em cada tela.
- **Front-end**: nenhuma mudança obrigatória; a lista de projetos já é invalidada/recarregada após a mudança de etapa, então o card aparece com a cor da prioridade Alta automaticamente. Se o card não atualizar a cor na hora em alguma das telas, adiciono `priority_id` no update otimista do Kanban/Lista.
