# Ajustes: Parceiros, tabela de demandas, modais e Perfis e Acessos

## 1. Botão de WhatsApp nos cartões de Parceiros

Nos cartões de `Parceiros`, hoje o telefone é só um link de ligação (`tel:`). Adicionar, ao lado, um botão "WhatsApp" que abre `https://wa.me/<numero>` em nova aba, com o número normalizado (remove espaços, parênteses, traços e aplica o prefixo 55 quando não houver código de país). O botão só aparece quando o contato tem telefone cadastrado.

## 2. Colunas da tabela de demandas não aparecem

Na visão em Lista de Demandas, o seletor "Colunas" marca todas as colunas, mas a tabela só mostra algumas. Motivo: além da seleção do usuário, cada coluna passa por um segundo filtro de visibilidade de campo (Perfis e Acessos). Quem não tem aqueles campos liberados na especialidade perde as colunas Cliente, Tipo de mídia, Prioridade, Prazo e Postagem, sobrando apenas Título/Etapa/Responsáveis.

Correção: manter o controle por Perfis e Acessos, mas alinhá-lo à realidade:
- Corrigir o mapeamento coluna → campo (hoje "media" aponta para uma chave que nem sempre bate com o registro de campos).
- Quando a especialidade do usuário não define nenhuma regra de campo, não esconder colunas (padrão permissivo em vez de restritivo).
- No menu "Colunas", mostrar como desabilitadas e com aviso as colunas bloqueadas por permissão, para ficar claro por que não aparecem.

## 3. Modal que ao fechar leva para outra página

No Calendário, clicar em uma demanda navega para `/projects?detail=<id>`; por isso, ao fechar/salvar o modal, o usuário fica em Demandas. Correção: abrir o detalhe da demanda em um modal dentro da própria página do Calendário (sem navegar). O mesmo padrão será verificado nos atalhos do Dashboard e de Clientes: o fechamento do modal limpa o parâmetro `detail` e permanece na página de origem.

## 4. Perfis e Acessos automático (menus e campos)

Hoje a lista de menus e a lista de campos liberáveis são escritas à mão em um arquivo de registro. Se alguém cria um menu novo, ele não aparece nas liberações até que essa lista seja editada manualmente.

Nova abordagem:
- **Menus**: gerar a lista automaticamente a partir das rotas reais da aplicação (árvore de rotas gerada no build). Toda rota nova do app entra sozinha na tela de liberação por Área. Um mapa opcional de rótulos/grupos traduz a rota para nome amigável; rotas sem rótulo aparecem com nome derivado do caminho, nunca ficam de fora.
- **Campos**: gerar a lista automaticamente a partir das colunas reais da tabela de demandas (tipos gerados do banco), filtrando colunas internas (ids técnicos, datas de sistema). Campo novo criado no banco aparece sozinho na liberação de "ver/editar" por Especialidade.
- **UI**: na aba Áreas & Especialidades, trocar as listas longas por um seletor (dropdown com busca) de menus e de campos: escolhe-se o item e ele é adicionado à lista de liberações, com marcação de "pode ver" / "pode editar" por especialidade. Contadores mostram quantos itens já estão liberados e quantos são novos ainda não configurados.
- **Sinalização de novidade**: itens detectados que ainda não têm decisão registrada aparecem destacados como "Novo", com ação em massa "liberar todos" / "manter bloqueado".

Regra mantida: nada é liberado automaticamente — o item novo aparece automaticamente na tela, mas continua bloqueado até um admin decidir.

## Detalhes técnicos

- `src/routes/_app/parceiros.tsx`: botão WhatsApp + helper de normalização de número.
- `src/routes/_app/projects.tsx`: ajustar `colKeyToField`, tornar `allowedCols` permissivo quando não há regras, e desabilitar itens bloqueados no dropdown "Colunas".
- `src/routes/_app/calendario.tsx`: modal de detalhe local (componente de detalhe extraído de `projects.tsx` para um arquivo compartilhado, ex.: `src/components/ProjectDetailDialog.tsx`), removendo o `navigate({ to: "/projects" })`.
- `src/lib/access-registry.ts`: passa a derivar menus de `routeTree.gen.ts` (rotas `/_app/*`) e campos das colunas de `projects` em `src/integrations/supabase/types.ts`, mantendo `MENU_REGISTRY`/`FIELD_REGISTRY` como exportações compatíveis.
- `src/routes/_app/acessos.tsx`: seletores com busca (Command/Popover) para menus e campos, badges de "Novo" e ações em massa.
- Sem mudanças de banco: as tabelas `area_menu_visibility` e `specialty_field_visibility` continuam guardando as decisões.
