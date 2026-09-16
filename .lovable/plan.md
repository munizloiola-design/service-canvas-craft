# Check geral do sistema — o que está bom, o que corrigir e o que melhorar

## Situação atual (verificado agora)

- Compilação do app: **OK**, sem erros.
- Erros de execução e avisos no navegador: **nenhum registrado**.
- Alertas de monitoramento pendentes: **nenhum** (os dois últimos já foram resolvidos).
- Verificação de segurança do banco: **5 avisos**, nenhum crítico.

## Pontos a corrigir (segurança dos formulários públicos)

Os três formulários abertos ao público aceitam hoje campos que só a equipe deveria preencher. Ninguém explorou isso, mas é uma porta aberta:

1. **Cadastro público de usuário/empresa** — quem preenche o formulário pode pedir o nível "administrador". Hoje isso só apareceria na hora da aprovação, podendo induzir alguém da equipe ao erro. Correção: o formulário público só pode pedir níveis comuns.
2. **Pedido público de lançamento financeiro** — o formulário aceita gravar campos de análise (quem revisou, observações da revisão, lançamento vinculado). Correção: esses campos passam a ser sempre vazios na entrada pública.
3. **Abertura pública de chamado** — aceita preencher "observações internas" e "observações da revisão", que são campos de uso interno. Correção: bloquear esses dois campos na entrada pública.

Esses três ajustes são feitos nas regras do banco, sem mudar nenhuma tela.

## Sugestões para trabalhar no futuro (não urgentes)

- **Avisos de funções do banco (44 itens):** são funções internas de verificação de permissão marcadas como executáveis. Não expõem dados, mas vale uma faxina para reduzir a superfície e limpar o relatório de segurança.
- **Telas muito grandes:** Demandas (80 KB), Financeiro (71 KB), Clientes (60 KB) e Dashboard (56 KB) concentram muita coisa num arquivo só. Dividir em partes menores deixa a manutenção mais rápida e reduz risco de quebrar uma área ao mexer em outra.
- **Volume de dados:** hoje a leitura em páginas já cobre as listas principais. Conforme o histórico crescer, vale trocar "carregar tudo" por "carregar só o período/filtro em uso" nas telas de Demandas, Calendário e Dashboard, para carregar mais rápido.
- **Fórmula de eficiência:** ficou pendente a sua decisão entre a fórmula atual (demandas no prazo ÷ total) e a completa (pontualidade menos taxa de retorno). Posso implementar as duas com um seletor.
- **Testes automáticos das regras de acesso:** hoje só o financeiro tem testes. Criar testes para as regras de fase por especialidade evitaria regressões nas contagens do Dashboard.

## Detalhes técnicos

- Migração única com `ALTER POLICY ... WITH CHECK` em:
  - `pending_registrations` (`Anyone can submit registrations`): restringir `requested_role` a valores não privilegiados (`membro`/`cliente`) ou `NULL`.
  - `financial_entry_requests` (`fer_insert_public`): exigir `reviewed_by IS NULL AND reviewed_at IS NULL AND review_notes IS NULL AND created_entry_id IS NULL`.
  - `ticket_requests` (`tr_insert_public`): exigir `internal_notes IS NULL AND review_notes IS NULL`.
- Nenhuma alteração de schema, colunas ou front-end.
- Depois: rodar novamente a verificação de segurança para confirmar os três itens resolvidos.

## Escopo

Este plano cobre apenas as três correções de segurança. As sugestões ficam registradas para você escolher quando quiser.
