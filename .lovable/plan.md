
# Plano de evolução do sistema

Vamos quebrar em fases para manter qualidade. Começo executando a Fase 1 imediatamente assim que você aprovar.

---

## Fase 1 — Financeiro + Equipamentos + Orçamento (foco agora)

### 1. Cadastro de Equipamentos (`/equipamentos`)
Tabela `equipments` com:
- código (auto-gerado, editável)
- nome, tipo (categoria livre), valor de aquisição
- data de aquisição → calcula tempo de uso
- **% de depreciação ao ano** (definida por equipamento)
- valor depreciado atual = valor × (1 − %aa)^anos (calculado em tempo real)

Tela com listagem, filtro por tipo, formulário CRUD e card de resumo (valor total, depreciação acumulada do mês).

### 2. Financeiro (`/financeiro`)
Sub-abas:
- **Custos fixos** (`fixed_costs`): nome, categoria, valor, recorrência (mensal/anual), dia do vencimento, ativo
- **Receitas recorrentes** (`recurring_incomes`): cliente vinculado, descrição, valor, recorrência, próximo vencimento
- **Lançamentos** (`financial_entries`): entrada/saída avulsa com data, valor, categoria, descrição, projeto vinculado (opcional), comprovante anexável
- **Resumo**: cards de Entradas, Saídas, Impostos, Comissões, Depreciação do mês + gráfico mensal (12 meses) entradas vs saídas; filtro por período

Cálculos automáticos:
- Imposto: % configurável no cadastro (ex.: 6% Simples) aplicado sobre receitas
- Comissões: % por colaborador (campo no `profiles`) aplicado sobre projetos concluídos
- Depreciação do mês: soma da depreciação mensal de todos equipamentos ativos

### 3. Orçamento (`/orcamento`)
Calculadora interativa (não persiste por padrão, com botão "salvar simulação"):
- Inputs: nº horas trabalhadas, custos fixos do mês (auto-preenchido), profissionais selecionados (puxa custo/hora do perfil), % lucro, % imposto
- Outputs: custo/hora da operação, custo total do projeto, preço sugerido, margem líquida
- Botão "Gerar PDF" da proposta

### 4. Cadastros adicionais
Adicionar em `/cadastros`: aba **Configurações Financeiras** (alíquota de imposto padrão, % comissão padrão) e em **Equipe** o campo `custo_hora` por colaborador.

---

## Fase 2 — Próximas (depois da Fase 1 aprovada)

- **Status configurável nas demandas** + área de **Funções e Permissões** (admin define o que cada role vê em cada propriedade/área)
- **Calendários** (prazo + postagem) e **filtros combinados** em Projetos
- **Cronômetro oculto** de tempo médio por status (trigger no `project_transitions`) + **Relatórios** (financeiro, tempo por status, por profissional, exportar CSV/PDF)
- **Dashboard personalizável** (escolher widgets/cards visíveis por usuário)

## Fase 3 — Integrações

- **Facebook Business**: criar app Meta + OAuth — preciso que você crie o App no [developers.facebook.com](https://developers.facebook.com), me passe `FACEBOOK_APP_ID` e `FACEBOOK_APP_SECRET`, e pré-aprovar permissões (`pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `ads_read`). Vou montar o fluxo de conexão e leitura/posting de páginas.
- **Diguinho (IA)**: chat lateral usando Lovable AI Gateway (`gemini-3-flash-preview`), sem chave extra. Apresentação inicial com top trends gerais + por área de interesse, baseado em conhecimento do modelo (sem dados ao vivo, conforme escolhido). Persiste histórico por usuário.

---

## Detalhes técnicos (Fase 1)

**Migração**: novas tabelas `equipments`, `fixed_costs`, `recurring_incomes`, `financial_entries`, `budget_simulations`, `financial_settings` (singleton). Coluna `hourly_cost` em `profiles`. RLS: leitura para autenticados, escrita só para admin/gerente (reusa `is_manager()`).

**Storage**: bucket `financial-receipts` (privado) para comprovantes.

**Stack**: TanStack Start + shadcn (Tabs, Card, Table, Dialog, Form com zod), `recharts` para gráficos, `date-fns` para período.

**Navegação**: adicionar "Financeiro", "Orçamento" e "Equipamentos" no sidebar (`src/routes/_app.tsx`).

---

**Posso começar pela Fase 1?** Depois que ela estiver rodando, sigo para Fase 2 e por último as integrações.
