## Objetivo
Criar a tabela `public.time_logs` para rastreamento oculto de tempo por projeto/usuário/status, com RLS adequada e GRANTs obrigatórios (que faltavam no SQL enviado).

## Ajustes ao SQL enviado
1. **Adicionar GRANTs** — obrigatório no schema `public`, senão a Data API retorna erro de permissão.
2. **Remover coluna gerada `duration_seconds`** — `EXTRACT(EPOCH FROM ...)` não é `IMMUTABLE`, então Postgres rejeita em `GENERATED ALWAYS AS ... STORED`. Substituir por uma **view** `time_logs_with_duration` ou uma coluna comum preenchida por trigger no `UPDATE` quando `ended_at` for setado. Recomendo a view (mais simples e sempre consistente).
3. **Separar policies** — a policy `FOR ALL` com só `USING` não cobre `WITH CHECK` em INSERT/UPDATE. Dividir em:
   - INSERT/UPDATE/DELETE do próprio usuário (com `WITH CHECK`).
   - SELECT do próprio usuário + SELECT de gestores/admins.
4. **FK do `user_id`** — apontar para `auth.users(id)` (padrão do projeto) em vez de `profiles(id)`, mantendo consistência com as demais tabelas.
5. Adicionar índices em `(project_id)`, `(user_id)`, `(started_at)` para consultas de relatório.

## Migração final (resumo)
```sql
CREATE TABLE public.time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status_id UUID REFERENCES public.workflow_statuses(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_logs_project ON public.time_logs(project_id);
CREATE INDEX idx_time_logs_user ON public.time_logs(user_id);
CREATE INDEX idx_time_logs_started ON public.time_logs(started_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_logs TO authenticated;
GRANT ALL ON public.time_logs TO service_role;

ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_select" ON public.time_logs FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "managers_select_all" ON public.time_logs FOR SELECT
  USING (public.is_manager(auth.uid()) OR public.is_master(auth.uid()));
CREATE POLICY "own_insert" ON public.time_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON public.time_logs FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_delete" ON public.time_logs FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE VIEW public.time_logs_with_duration AS
  SELECT *, EXTRACT(EPOCH FROM (ended_at - started_at))::INT AS duration_seconds
  FROM public.time_logs;
GRANT SELECT ON public.time_logs_with_duration TO authenticated;
```

## Perguntas antes de aplicar
1. Este é só o schema, ou você quer que eu **já integre** o tracking automático (iniciar log quando o projeto entra num status, encerrar quando muda) e uma **tela de relatório de tempo** para gestores?
2. `user_id` deve referenciar `auth.users` (padrão do projeto) — confirma?
