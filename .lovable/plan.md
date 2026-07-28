## Objetivo
Criar um formulário público (sem login) para envio de lançamentos financeiros, com fila de moderação no módulo Financeiro, semelhante ao fluxo de `/ticket`.

## Fluxo do usuário
1. Admin abre **Financeiro → Lançamentos**, vê um botão **"Compartilhar link de envio"** (com copiar link + preview do QR).
2. Qualquer pessoa acessa `/lancamento`, preenche o formulário e envia.
3. Envio cai na nova aba **Financeiro → Solicitações**, com contador de pendentes.
4. Admin revisa cada item e clica **Aprovar** (vira `financial_entries`) ou **Rejeitar** (arquiva com motivo). Também pode editar antes de aprovar.

## Campos do formulário (`/lancamento`)
- Nome de quem enviou * (texto)
- E-mail * (para retorno)
- Tipo * (Entrada / Saída)
- Data * (date)
- Descrição * (texto)
- Valor * (numérico, R$)
- Categoria (select opcional, alimentado por `financial_categories` filtrado por `kind`)
- Comprovante (upload opcional, 1 arquivo, ≤10MB) → bucket `financial-receipts` em `public/pending/<request_id>/...`
- Observações (textarea opcional)

Validação com zod + autofill de nome/e-mail via localStorage (mesmo padrão do `/ticket`).

## Estrutura técnica

### Banco (migração)
Nova tabela `public.financial_entry_requests`:
- `id uuid pk`, `created_at`, `reviewed_at`, `reviewed_by uuid`
- `requester_name text`, `requester_email text`, `requester_notes text`
- `kind text` (`income`/`expense`), `entry_date date`, `description text`, `amount numeric`, `category_id uuid` (fk opcional)
- `receipt_path text` (opcional)
- `status text` (`pendente` | `aprovado` | `rejeitado`), `review_notes text`
- `created_entry_id uuid` (fk `financial_entries.id`, preenchida na aprovação)

Grants + RLS:
- `GRANT INSERT ON public.financial_entry_requests TO anon, authenticated` (permite envio público)
- `GRANT SELECT/UPDATE/DELETE` só para `authenticated` + policies restringindo a `is_manager(auth.uid())` (mesma regra do restante do Financeiro).
- `SELECT` liberado apenas para managers; nenhum `SELECT` para `anon`.

Bucket `financial-receipts` já existe (privado). Adicionar policy de INSERT para `anon` apenas em `public/pending/*` e SELECT para managers.

### Frontend
- Novo arquivo `src/routes/lancamento.tsx` (público, sem `_app`), estilo/estrutura idêntico ao `src/routes/ticket.tsx`, adaptado aos campos financeiros. Head meta próprio.
- `src/routes/_app/financeiro.tsx`:
  - Botão **"Link de envio público"** no cabeçalho da aba Lançamentos: mostra a URL (`${origin}/lancamento`) + botões "Copiar" e "Abrir".
  - Nova aba **Solicitações** com lista (pendentes/aprovadas/rejeitadas), detalhes em `Sheet`, ações Aprovar (cria linha em `financial_entries` via `insert`) e Rejeitar (com motivo). Badge com contador de pendentes na aba.

### Regras de negócio na aprovação
- Cria `financial_entries` com `kind`, `entry_date`, `description`, `amount`, `category_id`, `receipt_path` (mesmo path, permanece no bucket), `source_type = 'manual'`, `created_by = auth.uid()`.
- Atualiza request: `status='aprovado'`, `reviewed_by`, `reviewed_at`, `created_entry_id`.
- Rejeição: apenas atualiza status + `review_notes`; anexo permanece.

## Segurança
- Zod no client + limites de tamanho no submit.
- Nenhum dado sensível é retornado ao público.
- Só managers leem/aprovam (via `is_manager`).
- Upload restrito a prefixo `public/pending/` e mime/size validados no client.

## Arquivos afetados
- **Novo:** `src/routes/lancamento.tsx`
- **Editar:** `src/routes/_app/financeiro.tsx` (botão + nova aba Solicitações)
- **Migração:** cria `financial_entry_requests` + grants/RLS + policies de storage
