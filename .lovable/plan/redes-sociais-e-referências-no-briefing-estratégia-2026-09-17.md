# Redes sociais e referências no Briefing & Estratégia

Duas novas áreas no cadastro de Briefing & Estratégia do cliente, com listas onde é possível adicionar quantos itens forem necessários.

## 1. Redes sociais

Substitui o bloco atual "Análise das Redes Sociais". Passa a ter:

- Uma lista de redes cadastradas, cada linha com:
  - Rede (Instagram, Facebook, TikTok, YouTube, LinkedIn, X, Pinterest, Outra)
  - Perfil / @usuário
  - Link do perfil (com botão de abrir em nova aba)
  - E-mail de acesso
  - Observações
  - Botão de remover
- Botão "Adicionar rede"
- O campo "Diagnóstico atual das redes" continua existindo, agora dentro dessa mesma área, logo abaixo da lista.

Nenhuma senha é pedida ou guardada.

## 2. Referências de pesquisa

Nova área "Referências de pesquisa (sites e perfis)", com lista onde cada linha tem:

- Nome / descrição
- Tipo (Site, Instagram, Blog, Concorrente, Outro)
- Link (com botão de abrir)
- Por que é relevante (observação curta)
- Botão de remover

Botão "Adicionar referência".

## Visualização do cliente

Na área estratégica que o cliente enxerga no portal, as duas novas áreas aparecem em modo somente leitura: as redes cadastradas (sem o e-mail de acesso, que é informação interna) e a lista de referências com links clicáveis.

## Detalhes técnicos

- Migração aditiva em `client_briefings`: duas colunas `jsonb NOT NULL DEFAULT '[]'::jsonb` — `redes_sociais` e `referencias_pesquisa`. Sem alterar colunas existentes (`analise_redes` permanece).
- `src/routes/_app/clientes.index.tsx`: tipos `RedeSocial` e `ReferenciaPesquisa`, campos adicionados a `Briefing`/`emptyBriefing` com fallback `?? []` no carregamento, e dois `AccordionItem` editáveis no mesmo padrão dos blocos "Links importantes" e "Indicadores".
- `src/routes/portal/estrategia.tsx`: dois blocos de leitura equivalentes, omitindo o e-mail de acesso.
- Regenerar os tipos do banco após a migração.
