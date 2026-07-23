/**
 * Formats a Supabase / PostgREST error into a single human-readable string.
 * Surfaces message + code + details + hint so RLS violations, missing columns,
 * FK errors, etc. are all visible in a toast.
 */
export function describeSupabaseError(error: unknown): string {
  if (!error) return "Erro desconhecido";
  if (typeof error === "string") return error;

  const e = error as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
    error_description?: string;
    name?: string;
  };

  const parts: string[] = [];
  if (e.message) parts.push(e.message);
  else if (e.error_description) parts.push(e.error_description);
  else parts.push(String(error));

  if (e.code) parts.push(`[${e.code}]`);
  if (e.details) parts.push(`— ${e.details}`);
  if (e.hint) parts.push(`(dica: ${e.hint})`);

  return parts.join(" ");
}
