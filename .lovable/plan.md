## Situação atual

Verificado no código:
- **Aprovação de ticket** (`src/routes/_app/tickets.tsx`, linha 141-152): cria o projeto sem definir `status_id`, então cai no status padrão do banco — não vai para "Atendimento".
- **Formulário de demandas** (`src/routes/_app/projects.tsx`, linha 672): ainda mostra "Observações internas" como `Textarea` simples, abaixo da Descrição. Não existe `description_cards` nem `final_link`, e o anexo ainda se chama "Anexo de referência".

Ou seja, **nenhuma das 4 mudanças foi aplicada ainda**.

## Plano

### 1. Ticket aprovado vai para "Atendimento" no Kanban
Na mutation `approve` de `tickets.tsx`, buscar o `id` do `workflow_statuses` cujo nome seja "Atendimento" (fallback: primeiro status por `sort_order` caso não exista) e passar no `insert` do projeto como `status_id`.

### 2. Descrição em múltiplos cards
- Migration: adicionar coluna `description_cards jsonb` em `public.projects` (array de `{ title, content }`).
- No form (`projects.tsx`), substituir o `Textarea` único de Descrição por um componente dinâmico:
  - Card 01 (título fixo incremental), campo de texto, botão "Adicionar novo card" abaixo do último.
  - Cada clique adiciona "Card 02", "Card 03"… sempre com o botão logo abaixo do último card.
  - Botão de remover em cada card (exceto o primeiro).
- Salvar como `description_cards`. Manter `description` como concatenação dos cards para compatibilidade com views/kanban/portal atuais.
- Ao editar um projeto existente sem `description_cards`, inicializar com um Card 01 contendo a `description` atual.

### 3. "Observações internas" → "Direção de arte", acima da Descrição
- No form, renomear o label do campo `notes` para "Direção de arte" e mover o `Field` para **antes** do bloco de Descrição.
- Ajustar labels correspondentes em qualquer visualização que exiba "Observações internas" (Kanban card, detalhe do projeto, portal do cliente) para "Direção de arte".

### 4. "Anexo de referência" → "Arquivo ou link finalizado" + campo de link
- Migration: adicionar coluna `final_link text` em `public.projects`.
- No form, renomear a seção de upload de "Anexo de referência" para "Arquivo ou link finalizado" e adicionar um `Input` de URL (`final_link`) logo acima/abaixo do upload.
- Salvar o link no `insert`/`update` do projeto.
- Exibir o link (quando preenchido) no detalhe do projeto e no portal do cliente junto dos anexos.

## Detalhes técnicos

- **Migration** (uma única, aprovada antes das mudanças de código):
  ```sql
  ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS description_cards jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS final_link text;
  ```
- Arquivos alterados: `src/routes/_app/tickets.tsx`, `src/routes/_app/projects.tsx` (form + card do Kanban se exibir "Observações internas"), possivelmente `src/routes/portal/*` se exibir esses campos.
- Sem mudanças em permissões nem em RLS.