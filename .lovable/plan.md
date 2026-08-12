# Indicadores gerais: abrir modal com as demandas

Hoje, clicar em um indicador (Total, Em aberto, Concluídos, Urgentes, Atrasados) leva o usuário para a página Demandas com um filtro rápido. A proposta é manter o usuário no Dashboard e abrir uma modal com a lista das demandas daquele indicador.

## Como vai funcionar

- Clicar em qualquer um dos cinco indicadores abre uma modal com o título do indicador e a contagem (ex.: "Atrasados — 7 demandas").
- A lista mostra, por demanda: título, cliente, etapa (com a cor do status) e a data de prazo (destacada em vermelho quando atrasada).
- Ordenação: prioridade (mais alta primeiro) e depois prazo mais próximo.
- Clicar em uma demanda da lista abre o detalhe dela em Demandas (comportamento atual de abrir a demanda).
- No rodapé da modal, botão "Ver todas em Demandas", que mantém o atalho de hoje (vai para /projects já com o filtro rápido aplicado).
- A modal rola internamente e se adapta ao celular; se não houver demandas, mostra um estado vazio.
- Respeita o escopo atual: usuário comum vê só as demandas em que está marcado; admin/gerente com filtro por membro vê o recorte selecionado. Se o usuário não tem acesso ao menu Demandas, os cartões continuam sem clique.

## Detalhes técnicos

Arquivo: `src/routes/_app/dashboard.tsx` (componente `StatsOverview`).

- A query `projects-stats` passa a trazer também `title`, `client_id` e `team_id` — dados necessários para a lista (hoje só traz ids/datas).
- Cada item de `stats` ganha um `filter: (p) => boolean` (as mesmas expressões já usadas para calcular `total`, `open`, `done`, `urgent`, `overdue`), evitando duplicar regras.
- Estado local `openStat: string | null`; o cartão vira `<button>` que seta o estado em vez de `<Link>` (o `Link` migra para o rodapé da modal, preservando `search={{ detail: undefined, quick }}`).
- Modal com `Dialog`/`DialogContent` (`max-h-[85vh] flex flex-col`, corpo `overflow-y-auto`), reutilizando os mapas de `clients`, `workflow_statuses` e `priorities` já consultados na página.
- Item da lista navega com `to="/projects"` e `search={{ detail: p.id }}`, padrão já usado nos widgets de prazos.
