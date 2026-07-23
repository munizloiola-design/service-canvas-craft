
## O que será feito

### 1. Menu lateral: seção exclusiva "Cliente"
Em `src/routes/_app.tsx`, remover o item **Clientes** de dentro do grupo **Operação** e criar um novo grupo dedicado no menu chamado **Cliente**, contendo o link `/clientes` (ícone `Building2`). O grupo ficará posicionado logo após **Operação**, seguindo o mesmo padrão visual dos demais (Collapsible com label em caixa alta).

### 2. Drag-and-drop entre fases no CRM de prospecção
Em `src/routes/_app/clientes.tsx` (aba CRM Prospecção, componente `CrmTab` / `ProspectCard`), habilitar arrastar cards entre as colunas de estágio (Novo lead → Qualificação → Proposta enviada → Negociação → Ganho → Perdido) usando HTML5 drag-and-drop nativo (sem novas dependências).

- Cada `ProspectCard` recebe `draggable`, `onDragStart` que carrega o `client.id`.
- Cada coluna de estágio recebe `onDragOver` (preventDefault + destaque visual) e `onDrop` que dispara a mesma mutation `update` já existente, atualizando `prospect_stage` (e também `status` para `ativo`/`inativo` quando cair em "Ganho"/"Perdido", mantendo a lógica atual dos botões).
- Feedback visual leve: opacidade no card arrastado e borda destacada na coluna alvo.

### 3. Botão WhatsApp no card do prospect
No `ProspectCard`, adicionar um botão de ícone (lucide `MessageCircle`, cor verde) ao lado do botão de editar, exibido apenas quando `client.phone` existir. Ao clicar, abre `https://wa.me/<numero>` em nova aba, sanitizando o telefone (remove tudo que não for dígito) e prefixando `55` se não vier com DDI.

## Detalhes técnicos

- Sem migração de banco — reaproveita `clients.prospect_stage`, `status` e `phone`.
- Sem novas dependências — drag-and-drop com API nativa do browser.
- Nenhuma alteração em RLS ou lógica de permissão; a mutation `update` já usa a policy existente de `clients`.
- Nenhuma alteração no portal do cliente ou em outras rotas.
