# Especialidade: liberar seções dentro de cada menu

Hoje a liberação por Especialidade só lista campos da demanda. A ideia é passar a trabalhar em dois níveis: escolhe-se o **menu** e, dentro dele, marca-se **o que a pessoa pode ver/editar** — por exemplo, em `Clientes`, o designer só enxerga a aba **Briefing & Estratégia**.

## Como fica a tela

- Dropdown 1: **Menu** (a mesma lista automática usada na liberação por Área — todo menu novo aparece sozinho).
- Dropdown 2 / lista: **Itens daquele menu** (abas e seções), com marcação "pode ver" e "pode editar".
- Em `Demandas`, além das abas, continuam listados os **campos da demanda** (Título, Cliente, Prazo, Legenda, etc.).
- Badge "Novo" para itens ainda sem decisão + ações em massa "Liberar tudo deste menu" / "Bloquear tudo".
- Regra mantida: item novo nasce bloqueado até um admin liberar.

## Itens detectados por menu (automático)

| Menu | Seções |
|---|---|
| Clientes | Diretório, Acessos do portal, Briefing & Estratégia, Projetos ativos |
| Financeiro | Dashboard, Custos fixos, Recorrentes, Lançamentos, Autorizações, Solicitações, Relatório, Configurações |
| Demandas | Kanban, Lista + campos da demanda |
| Calendário | Mês, Semana, Entrega, Postagem |
| Tickets | Pendentes, Aprovados, Recusados |
| Aprovações | Pendentes, Aprovadas, Rejeitadas |
| Tempo | Por projeto, Por usuário, Detalhado |
| Relatório do Squad | Times, Membros, Atividades, Elenco |
| Equipe | Ficha, Notas |

Menus sem abas continuam com um item único "Acesso à página".

## Efeito prático

Quem não tem a seção liberada simplesmente não vê aquela aba na página (a aba some, e a primeira aba liberada vira a inicial). Sem nenhuma regra cadastrada para a especialidade, nada é escondido — comportamento atual preservado.

## Detalhes técnicos

- Sem mudança de banco: as decisões continuam em `specialty_field_visibility`, usando chaves compostas `menu:/clientes#briefing` no `field_key` (campos de demanda seguem com a chave simples).
- `src/lib/access-registry.ts`: novo `SECTION_REGISTRY` (mapa menu → seções, com rótulos) e helper `sectionKey(menu, section)`; `deriveFieldRegistry` continua para os campos da demanda.
- `src/lib/access-context.tsx`: novos helpers `canViewSection(menu, section)` / `canEditSection(...)` com fallback permissivo quando a especialidade não tem regra.
- `src/routes/_app/acessos.tsx`: `FieldVisibilityDialog` reestruturado em dois níveis (seletor de menu + lista de itens), com busca, badges "Novo" e ações em massa por menu.
- Páginas com abas (`clientes.index`, `financeiro`, `projects`, `calendario`, `tickets`, `aprovacoes`, `tempo`, `squad.relatorio`, `team`) passam a filtrar `TabsTrigger`/`TabsContent` por `canViewSection` e ajustar a aba inicial.
