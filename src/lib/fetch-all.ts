import { supabase } from "@/integrations/supabase/client";

/**
 * O PostgREST limita respostas a 1000 linhas por padrão. Tabelas de ligação
 * (ex.: project_assignees) já passaram desse volume, então precisamos paginar
 * para não "perder" os registros mais recentes.
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  table: string,
  columns = "*",
  pageSize = 1000,
  /** Colunas que formam uma chave única (ordenação estável entre páginas). */
  orderBy: string | string[] = "id",
): Promise<T[]> {
  const keys = Array.isArray(orderBy) ? orderBy : [orderBy];
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from(table as any) as any).select(columns);
    // Sem ordenação por chave única o Postgres pode repetir/pular linhas
    // entre as páginas.
    for (const k of keys) q = q.order(k, { ascending: true });
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}
